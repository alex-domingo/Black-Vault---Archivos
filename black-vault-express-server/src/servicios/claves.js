// Contraseñas: política, hash con bcrypt y verificación.
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Costo 10: el mínimo que recomienda OWASP. bcryptjs es JavaScript puro; un costo
// mayor haría lentos el inicio de sesión y la carga inicial.
export const COSTO_BCRYPT = 10;

/** Un solo mensaje por campo (abort): primero la longitud, luego la composición.
 *  bcrypt solo considera los primeros 72 bytes; se rechazan claves más largas para no truncarlas en silencio. */
export const esquemaClave = z
  .string({ error: 'La contraseña es obligatoria.' })
  .min(8, { error: 'La contraseña debe tener al menos 8 caracteres.', abort: true })
  .refine((clave) => Buffer.byteLength(clave, 'utf8') <= 72, { error: 'La contraseña no puede superar los 72 bytes.', abort: true })
  .refine((clave) => /\p{L}/u.test(clave) && /\d/.test(clave), 'La contraseña debe combinar letras y números.');

export function generarHash(clave) {
  return bcrypt.hash(clave, COSTO_BCRYPT);
}

export function verificarClave(clave, hash) {
  return bcrypt.compare(clave, hash);
}

// Hash de una clave que nadie conoce. Se compara contra él cuando el usuario no existe,
// para que esa respuesta tarde lo mismo y no revele qué usuarios están registrados.
let hashFicticio;
export async function compararContraFicticio(clave) {
  hashFicticio ??= await generarHash('clave-ficticia-que-nunca-coincide-2026');
  await bcrypt.compare(clave, hashFicticio);
}
