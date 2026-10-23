// Permiso efectivo de un usuario sobre una carpeta o un archivo (sección 3 del diseño).
//
// - El propietario tiene control total.
// - Los demás tienen el mayor nivel entre la compartición directa del recurso y las de
//   cualquiera de sus carpetas ancestro (herencia).
// - Lo que está en la papelera solo lo ve su propietario, y solo desde la papelera.
// - Sin acceso → 404 (no se revela que el recurso existe). Acceso insuficiente → 403.
import { coleccion } from '../bd/conexion.js';
import { errores } from '../utilidades/errores.js';
import { aObjectId } from '../utilidades/ids.js';

export const NIVELES = { lectura: 1, comentario: 2, edicion: 3, propietario: 4 };

const NOMBRES_NIVEL = { lectura: 'lectura', comentario: 'comentar', edicion: 'edición', propietario: 'propietario' };

const coleccionDe = (tipo) => (tipo === 'archivo' ? 'archivos' : 'carpetas');

/**
 * @param {object} usuario Usuario autenticado.
 * @param {'archivo'|'carpeta'} tipo
 * @param {string|import('mongodb').ObjectId} id
 * @param {{ incluirPapelera?: boolean, session?: import('mongodb').ClientSession }} [opciones]
 * @returns {Promise<{ recurso: object, nivel: string, raizVisible: import('mongodb').ObjectId|null }>}
 *   raizVisible: para quien no es propietario, la carpeta (o el archivo) compartida más alta
 *   del camino; la ruta que ve empieza ahí.
 */
export async function obtenerAcceso(usuario, tipo, id, { incluirPapelera = false, session } = {}) {
  const mensaje = tipo === 'archivo' ? 'El archivo no existe.' : 'La carpeta no existe.';
  const proyeccion = tipo === 'archivo' ? { comentarios: 0 } : undefined;
  const recurso = await coleccion(coleccionDe(tipo)).findOne(
    { _id: aObjectId(id, mensaje) },
    { projection: proyeccion, session },
  );
  if (!recurso) throw errores.noEncontrado(mensaje);

  if (recurso.propietarioId.equals(usuario._id)) {
    if (recurso.enPapelera && !incluirPapelera) throw errores.noEncontrado(mensaje);
    return { recurso, nivel: 'propietario', raizVisible: null };
  }

  if (recurso.enPapelera) throw errores.noEncontrado(mensaje);

  const camino = [...recurso.ancestros, recurso._id];
  const comparticiones = await coleccion('comparticiones')
    .find({ destinatarioId: usuario._id, recursoId: { $in: camino } }, { projection: { recursoId: 1, permiso: 1 }, session })
    .toArray();
  if (comparticiones.length === 0) throw errores.noEncontrado(mensaje);

  const nivel = comparticiones.reduce(
    (mayor, c) => (NIVELES[c.permiso] > NIVELES[mayor] ? c.permiso : mayor),
    'lectura',
  );
  const compartidos = new Set(comparticiones.map((c) => c.recursoId.toString()));
  const raizVisible = camino.find((idCamino) => compartidos.has(idCamino.toString())) ?? null;
  return { recurso, nivel, raizVisible };
}

/** Exige un nivel mínimo. Lanza 403 con el nivel que el usuario sí tiene. */
export function exigirNivel(acceso, minimo, accion) {
  if (NIVELES[acceso.nivel] >= NIVELES[minimo]) return;
  if (minimo === 'propietario') {
    throw errores.prohibido(`Solo el propietario puede ${accion}.`);
  }
  throw errores.prohibido(`Tu permiso sobre este recurso es de ${NOMBRES_NIVEL[acceso.nivel]}; no puedes ${accion}.`);
}

/**
 * Ruta (breadcrumb) hasta un recurso: [{ _id, nombre }] de la raíz hacia abajo.
 * Para una carpeta incluye la propia carpeta; para un archivo, solo sus carpetas.
 * Quien no es propietario solo ve desde la carpeta compartida más alta.
 */
export async function construirRuta(tipo, recurso, raizVisible, { session } = {}) {
  let ids = tipo === 'carpeta' ? [...recurso.ancestros, recurso._id] : [...recurso.ancestros];
  if (raizVisible) {
    const desde = ids.findIndex((id) => id.equals(raizVisible));
    ids = desde === -1 ? [] : ids.slice(desde);
  }
  if (ids.length === 0) return [];

  const carpetas = await coleccion('carpetas')
    .find({ _id: { $in: ids } }, { projection: { nombre: 1 }, session })
    .toArray();
  const nombres = new Map(carpetas.map((c) => [c._id.toString(), c.nombre]));
  return ids.map((id) => ({ _id: id, nombre: nombres.get(id.toString()) ?? '(sin nombre)' }));
}
