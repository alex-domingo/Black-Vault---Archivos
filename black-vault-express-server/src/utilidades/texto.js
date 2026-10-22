/** Escapa un texto para usarlo dentro de una expresión regular (evita inyección de regex). */
export function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
