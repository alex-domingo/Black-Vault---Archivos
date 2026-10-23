// Espacio de almacenamiento por usuario (almacenamiento.usadoBytes / cuotaBytes).
import { coleccion } from '../bd/conexion.js';
import { errores } from '../utilidades/errores.js';

const MB = 1024 * 1024;
const enMb = (bytes) => `${Math.round((bytes / MB) * 100) / 100} MB`;

/**
 * Reserva espacio de forma atómica: el $inc solo se aplica si cabe en la cuota.
 * Es una sola escritura sobre un documento, así que no necesita transacción.
 */
export async function reservarCuota(propietarioId, bytes, { session } = {}) {
  if (bytes <= 0) return;
  const resultado = await coleccion('usuarios').updateOne(
    {
      _id: propietarioId,
      $expr: { $lte: [{ $add: ['$almacenamiento.usadoBytes', bytes] }, '$almacenamiento.cuotaBytes'] },
    },
    { $inc: { 'almacenamiento.usadoBytes': bytes } },
    { session },
  );
  if (resultado.matchedCount === 0) {
    const dueno = await coleccion('usuarios').findOne({ _id: propietarioId }, { projection: { almacenamiento: 1 }, session });
    const disponible = dueno ? dueno.almacenamiento.cuotaBytes - dueno.almacenamiento.usadoBytes : 0;
    throw errores.cuotaExcedida(
      `No hay espacio suficiente: se necesitan ${enMb(bytes)} y quedan ${enMb(Math.max(0, disponible))} en la cuota del propietario.`,
    );
  }
}

/** Devuelve espacio. Nunca deja el contador por debajo de cero. */
export async function liberarCuota(propietarioId, bytes, { session } = {}) {
  if (bytes <= 0) return;
  await coleccion('usuarios').updateOne(
    { _id: propietarioId },
    [{ $set: { 'almacenamiento.usadoBytes': { $max: [0, { $subtract: ['$almacenamiento.usadoBytes', bytes] }] } } }],
    { session },
  );
}
