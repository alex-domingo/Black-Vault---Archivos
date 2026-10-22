// Ejecuta un conjunto de operaciones de forma atómica cuando MongoDB lo permite.
//
// - Replica set: todo corre dentro de una transacción (withTransaction reintenta
//   automáticamente ante errores transitorios, así que `trabajo` no debe tener
//   efectos fuera de la base de datos).
// - Standalone (instalación normal en Windows): las operaciones corren en orden,
//   sin transacción. Por eso cada servicio ordena sus pasos y compensa si algo falla.
//
// `trabajo` recibe la sesión (o undefined) y debe pasarla a cada operación: { session }.
import { obtenerCliente, haySoporteTransacciones } from './conexion.js';

export async function ejecutarAtomico(trabajo) {
  if (!haySoporteTransacciones()) {
    return trabajo(undefined);
  }

  const sesion = obtenerCliente().startSession();
  try {
    let resultado;
    await sesion.withTransaction(async () => {
      resultado = await trabajo(sesion);
    });
    return resultado;
  } finally {
    await sesion.endSession();
  }
}
