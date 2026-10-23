// Forma en que carpetas y archivos se envían al cliente, y copias para el historial.
import { coleccion } from '../bd/conexion.js';

export function carpetaPublica(carpeta) {
  return {
    _id: carpeta._id,
    tipo: 'carpeta',
    nombre: carpeta.nombre,
    padreId: carpeta.padreId,
    propietarioId: carpeta.propietarioId,
    creadoPor: carpeta.creadoPor,
    creadoEn: carpeta.creadoEn,
    actualizadoEn: carpeta.actualizadoEn,
  };
}

/** No incluye el id de GridFS ni los comentarios (que se piden aparte). */
export function archivoPublico(archivo) {
  return {
    _id: archivo._id,
    tipo: 'archivo',
    nombre: archivo.nombre,
    extension: archivo.extension,
    tipoMime: archivo.tipoMime,
    categoria: archivo.categoria,
    etiquetas: archivo.etiquetas,
    descripcion: archivo.descripcion,
    bytes: archivo.contenido.bytes,
    version: archivo.contenido.version,
    sha256: archivo.contenido.sha256,
    carpetaId: archivo.carpetaId,
    propietarioId: archivo.propietarioId,
    creadoPor: archivo.creadoPor,
    creadoEn: archivo.creadoEn,
    actualizadoEn: archivo.actualizadoEn,
    contenidoActualizadoEn: archivo.contenido.actualizadoEn,
    contenidoActualizadoPor: archivo.contenido.actualizadoPor,
  };
}

/** Copia del recurso para el historial (nombre en ese momento). */
export function recursoParaHistorial(tipo, recurso) {
  return { tipo, _id: recurso._id, nombre: recurso.nombre, propietarioId: recurso.propietarioId };
}

/** Mapa id → { _id, nombreUsuario, nombreCompleto } para mostrar propietarios y autores. */
export async function resumenesDeUsuarios(ids, { session } = {}) {
  const unicos = [...new Map(ids.filter(Boolean).map((id) => [id.toString(), id])).values()];
  if (unicos.length === 0) return new Map();
  const usuarios = await coleccion('usuarios')
    .find({ _id: { $in: unicos } }, { projection: { nombreUsuario: 1, nombreCompleto: 1 }, session })
    .toArray();
  return new Map(usuarios.map((u) => [u._id.toString(), u]));
}
