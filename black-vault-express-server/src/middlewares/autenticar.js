// Verifica el JWT de la cabecera Authorization y carga al usuario en req.usuario.
// El usuario se vuelve a leer en cada petición: si fue desactivado o cambió su clave,
// la sesión deja de servir en ese mismo instante.
import { ObjectId } from 'mongodb';
import { coleccion } from '../bd/conexion.js';
import { verificarToken } from '../servicios/tokens.js';
import { ErrorApi, errores } from '../utilidades/errores.js';

const sesionInvalida = () => new ErrorApi(401, 'SESION_INVALIDA', 'Tu sesión ya no es válida. Inicia sesión de nuevo.');

export async function autenticar(req, res, next) {
  const coincidencia = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
  if (!coincidencia) throw errores.noAutenticado();

  let contenido;
  try {
    contenido = verificarToken(coincidencia[1]);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ErrorApi(401, 'SESION_EXPIRADA', 'Tu sesión expiró. Inicia sesión de nuevo.');
    }
    throw sesionInvalida();
  }

  if (!ObjectId.isValid(contenido.sub)) throw sesionInvalida();

  const usuario = await coleccion('usuarios').findOne(
    { _id: new ObjectId(contenido.sub) },
    { projection: { claveHash: 0 } },
  );
  if (!usuario || !usuario.activo || usuario.versionSesion !== contenido.ver) throw sesionInvalida();

  req.usuario = usuario;
  next();
}

/** Permite el paso solo a los roles indicados (después de autenticar). */
export function requerirRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      throw errores.prohibido('Esta sección es solo para administradores.');
    }
    next();
  };
}
