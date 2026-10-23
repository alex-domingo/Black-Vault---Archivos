/** Escapa un texto para usarlo dentro de una expresión regular (evita inyección de regex). */
export function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const VARIANTES = [
  ['a', 'aáàäâ'],
  ['e', 'eéèëê'],
  ['i', 'iíìïî'],
  ['o', 'oóòöô'],
  ['u', 'uúùüû'],
  ['n', 'nñ'],
];
const CLASE_DE = new Map(VARIANTES.flatMap(([, letras]) => [...letras].map((letra) => [letra, `[${letras}]`])));

/**
 * Expresión regular que encuentra el texto sin importar tildes ni mayúsculas:
 * "mendez" encuentra "Méndez" y "nunez" encuentra "Núñez".
 */
export function patronSinTildes(texto) {
  const escapado = escaparRegex(texto.normalize('NFC').toLowerCase());
  return new RegExp([...escapado].map((c) => CLASE_DE.get(c) ?? c).join(''), 'i');
}
