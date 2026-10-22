// Registro del historial de actividad (colección "actividades").
// Cada entrada guarda una copia del actor y del recurso tal como eran en ese momento
// (patrón Extended Reference), para que el historial sobreviva a renombres,
// eliminaciones definitivas y desactivaciones.
import { coleccion } from '../bd/conexion.js';

/** Copia mínima de un usuario para el historial. */
export function resumenUsuario(usuario) {
  return { _id: usuario._id, nombreUsuario: usuario.nombreUsuario, nombreCompleto: usuario.nombreCompleto };
}

function resumenActor(usuario) {
  return { ...resumenUsuario(usuario), rol: usuario.rol };
}

/**
 * Registra una acción. Un fallo al escribir el historial no debe deshacer ni ocultar
 * una operación que ya se completó, así que se informa en consola y no se propaga.
 *
 * @param {object} entrada
 * @param {string} entrada.accion          Por ejemplo, 'USUARIO_CREADO'.
 * @param {string} entrada.categoria       'autenticacion' | 'usuarios' | 'carpetas' | 'archivos' | 'papelera' | 'comparticiones'
 * @param {object} entrada.actor           Usuario que realiza la acción.
 * @param {object} [entrada.recurso]       { tipo, _id, nombre, propietarioId }
 * @param {object} [entrada.usuarioAfectado] Usuario sobre el que recae la acción.
 * @param {object} [entrada.detalles]
 * @param {string} [entrada.ip]
 * @param {Date}   [entrada.fecha]
 * @param {{ session?: import('mongodb').ClientSession }} [opciones]
 */
export async function registrarActividad(
  { accion, categoria, actor, recurso, usuarioAfectado, detalles, ip, fecha = new Date() },
  { session } = {},
) {
  const documento = { accion, categoria, fecha, actor: resumenActor(actor) };
  if (recurso) documento.recurso = recurso;
  if (usuarioAfectado) documento.usuarioAfectado = resumenUsuario(usuarioAfectado);
  if (detalles && Object.keys(detalles).length) documento.detalles = detalles;
  if (ip) documento.ip = ip;

  try {
    await coleccion('actividades').insertOne(documento, { session });
  } catch (error) {
    console.error(`No se pudo registrar la actividad ${accion}:`, error.message);
  }
}
