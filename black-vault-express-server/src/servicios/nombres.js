// Validación y normalización de nombres de carpetas y archivos (sección 5.1 del diseño).
import { errores } from '../utilidades/errores.js';

const MAXIMO = 255;
// Caracteres que Windows no admite en nombres de archivo, más los de control.
// eslint-disable-next-line no-control-regex
const PROHIBIDOS = /[\\/:*?"<>|\u0000-\u001f]/;
// Nombres reservados de Windows, con o sin extensión (CON, CON.txt…).
const RESERVADOS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Limpia y valida un nombre. Lanza 400 con un mensaje claro si no es válido. */
export function validarNombre(nombre, tipo = 'elemento') {
  if (typeof nombre !== 'string') throw errores.validacion(`El nombre del ${tipo} es obligatorio.`);
  const limpio = nombre.normalize('NFC').trim();
  if (!limpio) throw errores.validacion(`El nombre del ${tipo} es obligatorio.`);
  if (limpio.length > MAXIMO) throw errores.validacion(`El nombre no puede superar ${MAXIMO} caracteres.`);
  if (PROHIBIDOS.test(limpio)) throw errores.validacion('El nombre no puede contener \\ / : * ? " < > |');
  if (limpio.endsWith('.')) throw errores.validacion('El nombre no puede terminar en punto.');
  if (limpio === '.' || limpio === '..') throw errores.validacion('Ese nombre no está permitido.');
  if (RESERVADOS.test(limpio)) throw errores.validacion(`"${limpio}" es un nombre reservado del sistema.`);
  return limpio;
}

/**
 * Forma comparable de un nombre: minúsculas y sin tildes en las vocales, pero conservando la ñ
 * (para que "Año" y "ano" sean nombres distintos). Se usa para la unicidad, el orden y la búsqueda.
 */
export function normalizarNombre(texto) {
  return texto
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/([aeiou])[́̈̀]/g, '$1')
    .normalize('NFC');
}

/** Separa "informe final.md" en { base: 'informe final', extension: 'md' }. */
export function separarExtension(nombre) {
  const punto = nombre.lastIndexOf('.');
  if (punto <= 0) return { base: nombre, extension: '' };
  return { base: nombre.slice(0, punto), extension: nombre.slice(punto + 1).toLowerCase() };
}

/**
 * Devuelve el primer nombre libre en el destino: "nombre.md", "nombre (1).md", "nombre (2).md"…
 * Para carpetas (conExtension: false) el número va al final: "Versión 1.2 (1)".
 * @param {import('mongodb').Collection} coleccion
 * @param {object} filtroDestino Filtro que identifica el destino (padre y propietario).
 */
export async function siguienteNombreLibre(coleccion, filtroDestino, nombre, { session, conExtension = true } = {}) {
  const { base, extension } = conExtension ? separarExtension(nombre) : { base: nombre, extension: '' };
  const sufijo = extension ? `.${extension}` : '';
  for (let n = 0; n < 1000; n++) {
    const candidato = n === 0 ? nombre : `${base} (${n})${sufijo}`;
    const existe = await coleccion.countDocuments(
      { ...filtroDestino, nombreNormalizado: normalizarNombre(candidato), enPapelera: false },
      { limit: 1, session },
    );
    if (!existe) return candidato;
  }
  throw errores.conflicto('No se encontró un nombre disponible en el destino.');
}
