// Emisión y verificación de los JWT de sesión.
import jwt from 'jsonwebtoken';
import { entorno } from '../config/entorno.js';

const ALGORITMO = 'HS256';

/**
 * El token lleva el id (sub), el rol y la versión de sesión del usuario.
 * Si la versión cambia (cambio o restablecimiento de clave, desactivación),
 * todos los tokens anteriores dejan de ser válidos.
 */
export function firmarToken(usuario) {
  return jwt.sign({ rol: usuario.rol, ver: usuario.versionSesion }, entorno.JWT_SECRETO, {
    subject: usuario._id.toString(),
    expiresIn: entorno.JWT_EXPIRACION,
    algorithm: ALGORITMO,
  });
}

/** Devuelve el contenido del token o lanza un error de jsonwebtoken. */
export function verificarToken(token) {
  return jwt.verify(token, entorno.JWT_SECRETO, { algorithms: [ALGORITMO] });
}

/** Fecha de expiración (ISO) de un token recién emitido. */
export function expiracionDe(token) {
  const { exp } = jwt.decode(token);
  return new Date(exp * 1000).toISOString();
}
