// Contenido de los archivos en GridFS (bucket "contenidos").
// Nada se escribe en el disco del servidor: los bytes van de la memoria a MongoDB (RT-05).
// GridFS no admite sesiones en el driver 7.x, así que estas operaciones quedan fuera de
// las transacciones; los servicios las ordenan y compensan si algo falla.
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { obtenerBucket } from '../bd/conexion.js';

export function calcularSha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Guarda los bytes y devuelve el id del archivo de GridFS.
 * @param {Buffer} buffer
 * @param {{ nombre: string, archivoId: import('mongodb').ObjectId, propietarioId: import('mongodb').ObjectId, tipoMime: string, sha256: string }} datos
 */
export async function guardarContenido(buffer, { nombre, archivoId, propietarioId, tipoMime, sha256 }) {
  // El tipo MIME va en metadata: la opción contentType de GridFS está obsoleta en el driver.
  const subida = obtenerBucket().openUploadStream(nombre, { metadata: { archivoId, propietarioId, tipoMime, sha256 } });
  await pipeline(Readable.from([buffer]), subida);
  return subida.id;
}

/** Lee el contenido completo (los archivos son de texto y de pocos MB). */
export async function leerContenido(gridFsId) {
  const partes = [];
  for await (const parte of obtenerBucket().openDownloadStream(gridFsId)) partes.push(parte);
  return Buffer.concat(partes);
}

/** Flujo de lectura para descargas sin cargar el archivo completo en memoria. */
export function flujoDeDescarga(gridFsId) {
  return obtenerBucket().openDownloadStream(gridFsId);
}

/**
 * Borra el contenido. Si falla, solo se informa: quedan bytes huérfanos que la
 * verificación de integridad detecta, pero el usuario no ve ninguna inconsistencia.
 */
export async function eliminarContenido(gridFsId) {
  try {
    await obtenerBucket().delete(gridFsId);
  } catch (error) {
    if (!/FileNotFound|not found/i.test(error.message)) {
      console.error(`No se pudo eliminar el contenido ${gridFsId} de GridFS:`, error.message);
    }
  }
}
