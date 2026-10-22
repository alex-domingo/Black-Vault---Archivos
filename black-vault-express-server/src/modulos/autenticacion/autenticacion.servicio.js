// Inicio de sesión, perfil y cambio de contraseña.
import { coleccion } from '../../bd/conexion.js';
import { compararContraFicticio, generarHash, verificarClave } from '../../servicios/claves.js';
import { registrarActividad } from '../../servicios/historial.js';
import { expiracionDe, firmarToken } from '../../servicios/tokens.js';
import { ErrorApi } from '../../utilidades/errores.js';
import { usuarioPublico } from '../usuarios/usuarios.servicio.js';

const usuarios = () => coleccion('usuarios');

// Mismo mensaje si el usuario no existe o si la clave es incorrecta: no se revela qué cuentas existen.
const credencialesInvalidas = () => new ErrorApi(401, 'CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos.');

function sesionPara(usuario) {
  const token = firmarToken(usuario);
  return { token, expiraEn: expiracionDe(token), usuario: usuarioPublico(usuario) };
}

export async function iniciarSesion({ identificador, clave }, ip) {
  // Los nombres de usuario no admiten "@", así que un "@" indica que es un correo.
  const filtro = identificador.includes('@') ? { correo: identificador } : { nombreUsuario: identificador };
  const usuario = await usuarios().findOne(filtro);

  if (!usuario) {
    await compararContraFicticio(clave);
    throw credencialesInvalidas();
  }

  if (!(await verificarClave(clave, usuario.claveHash))) {
    await registrarActividad({
      accion: 'INICIO_SESION_FALLIDO',
      categoria: 'autenticacion',
      actor: usuario,
      detalles: { motivo: 'Contraseña incorrecta' },
      ip,
    });
    throw credencialesInvalidas();
  }

  // Se comprueba después de la clave para no revelar el estado de la cuenta a quien no la conoce.
  if (!usuario.activo) {
    await registrarActividad({
      accion: 'INICIO_SESION_FALLIDO',
      categoria: 'autenticacion',
      actor: usuario,
      detalles: { motivo: 'Usuario inactivo' },
      ip,
    });
    throw new ErrorApi(403, 'USUARIO_INACTIVO', 'Tu cuenta está desactivada. Contacta al administrador.');
  }

  const ahora = new Date();
  await usuarios().updateOne({ _id: usuario._id }, { $set: { ultimoAcceso: ahora } });
  await registrarActividad({ accion: 'INICIO_SESION', categoria: 'autenticacion', actor: usuario, ip, fecha: ahora });

  return sesionPara({ ...usuario, ultimoAcceso: ahora });
}

export async function cerrarSesion(usuario, ip) {
  await registrarActividad({ accion: 'CIERRE_SESION', categoria: 'autenticacion', actor: usuario, ip });
}

/**
 * Cambia la clave del propio usuario. Las demás sesiones abiertas quedan invalidadas;
 * la actual continúa con el token nuevo que se devuelve.
 */
export async function cambiarClave(usuario, { claveActual, claveNueva }, ip) {
  const { claveHash } = await usuarios().findOne({ _id: usuario._id }, { projection: { claveHash: 1 } });

  if (!(await verificarClave(claveActual, claveHash))) {
    throw new ErrorApi(400, 'CLAVE_ACTUAL_INCORRECTA', 'La contraseña actual no es correcta.');
  }
  if (claveActual === claveNueva) {
    throw new ErrorApi(400, 'VALIDACION', 'La nueva contraseña debe ser distinta de la actual.');
  }

  const actualizado = await usuarios().findOneAndUpdate(
    { _id: usuario._id },
    { $set: { claveHash: await generarHash(claveNueva), actualizadoEn: new Date() }, $inc: { versionSesion: 1 } },
    { returnDocument: 'after' },
  );
  await registrarActividad({ accion: 'CLAVE_CAMBIADA', categoria: 'autenticacion', actor: actualizado, ip });
  return sesionPara(actualizado);
}
