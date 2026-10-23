// Contenido de texto: decodificación estricta, marca BOM y tipo de salto de línea.
// Sirve para que la vista previa y la edición no alteren bytes que el usuario no tocó.

const BOM_UTF8 = Buffer.from([0xef, 0xbb, 0xbf]);

/** ¿Contiene bytes nulos? Un archivo .txt/.md con NUL no es texto (o es UTF-16, que no se admite). */
export function pareceBinario(buffer) {
  return buffer.subarray(0, 8192).includes(0);
}

/**
 * @returns {{ texto: string, esUtf8: boolean, tieneBom: boolean, saltos: 'crlf'|'lf' }}
 */
export function analizarTexto(buffer) {
  const tieneBom = buffer.subarray(0, 3).equals(BOM_UTF8);
  let texto;
  let esUtf8 = true;
  try {
    // TextDecoder quita el BOM del resultado (ignoreBOM: false por defecto).
    texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    esUtf8 = false;
    texto = new TextDecoder('utf-8').decode(buffer); // aproximado, solo para la vista previa
  }
  const crlf = (texto.match(/\r\n/g) ?? []).length;
  const lfSueltos = (texto.match(/(?<!\r)\n/g) ?? []).length;
  return { texto, esUtf8, tieneBom, saltos: crlf > lfSueltos ? 'crlf' : 'lf' };
}

/**
 * Convierte el texto editado en bytes conservando el formato del original.
 * El navegador entrega siempre LF; si el original usaba CRLF (Windows), se restaura.
 */
export function reconstruirBytes(textoEditado, { tieneBom, saltos }) {
  let texto = textoEditado.replace(/\r\n/g, '\n');
  if (saltos === 'crlf') texto = texto.replace(/\n/g, '\r\n');
  const cuerpo = Buffer.from(texto, 'utf8');
  return tieneBom ? Buffer.concat([BOM_UTF8, cuerpo]) : cuerpo;
}
