// Reglas de negocio de la administración de usuarios.
// - Los usuarios nunca se eliminan: se desactivan (RN-09).
// - Siempre debe quedar al menos un administrador activo.
// - Un administrador no puede desactivarse ni quitarse el rol a sí mismo.
// - La cuota nunca puede quedar por debajo del espacio ya usado.
import { MongoServerError } from 'mongodb';
import { coleccion } from '../../bd/conexion.js';
import { entorno } from '../../config/entorno.js';
import { generarHash } from '../../servicios/claves.js';
import { registrarActividad } from '../../servicios/historial.js';
import { errores } from '../../utilidades/errores.js';
import { aObjectId } from '../../utilidades/ids.js';
import { aSkipLimit, respuestaPaginada } from '../../utilidades/paginacion.js';
import { patronSinTildes } from '../../utilidades/texto.js';

const MB = 1024 * 1024;
const usuarios = () => coleccion('usuarios');
const SIN_SECRETOS = { projection: { claveHash: 0 } };

/** Datos de un usuario que se pueden enviar al cliente (nunca el hash ni la versión de sesión). */
export function usuarioPublico(usuario) {
  // eslint-disable-next-line no-unused-vars
  const { claveHash, versionSesion, ...publico } = usuario;
  return publico;
}

const formatoMb = (bytes) => `${Math.round((bytes / MB) * 100) / 100} MB`;

/** Traduce un índice único violado a un mensaje claro. */
function traducirDuplicado(error) {
  if (error instanceof MongoServerError && error.code === 11000) {
    if (error.keyPattern?.nombreUsuario) return errores.conflicto('Ya existe un usuario con ese nombre de usuario.');
    if (error.keyPattern?.correo) return errores.conflicto('Ya existe un usuario con ese correo.');
  }
  return error;
}

async function buscarOFallar(id) {
  const usuario = await usuarios().findOne({ _id: aObjectId(id, 'El usuario no existe.') });
  if (!usuario) throw errores.noEncontrado('El usuario no existe.');
  return usuario;
}

/** ¿Quedaría el sistema sin administradores activos si este usuario deja de serlo? */
async function esUltimoAdministradorActivo(usuario) {
  if (usuario.rol !== 'administrador' || !usuario.activo) return false;
  const otros = await usuarios().countDocuments({ rol: 'administrador', activo: true, _id: { $ne: usuario._id } });
  return otros === 0;
}

export async function listar({ buscar, rol, activo, pagina, limite }) {
  const filtro = {};
  if (rol) filtro.rol = rol;
  if (activo !== undefined) filtro.activo = activo;
  if (buscar) {
    const patron = patronSinTildes(buscar);
    filtro.$or = [{ nombreUsuario: patron }, { nombreCompleto: patron }, { correo: patron }];
  }
  const { skip, limit } = aSkipLimit({ pagina, limite });
  const [datos, total] = await Promise.all([
    usuarios().find(filtro, SIN_SECRETOS).sort({ nombreCompleto: 1, _id: 1 }).skip(skip).limit(limit).toArray(),
    usuarios().countDocuments(filtro),
  ]);
  return respuestaPaginada(datos.map(usuarioPublico), total, { pagina, limite });
}

export async function obtener(id) {
  return usuarioPublico(await buscarOFallar(id));
}

export async function crear(datos, actor, ip) {
  const ahora = new Date();
  const documento = {
    nombreUsuario: datos.nombreUsuario,
    correo: datos.correo,
    claveHash: await generarHash(datos.clave),
    nombreCompleto: datos.nombreCompleto,
    rol: datos.rol,
    activo: true,
    versionSesion: 0,
    almacenamiento: {
      usadoBytes: 0,
      cuotaBytes: datos.cuotaMb ? datos.cuotaMb * MB : entorno.CUOTA_POR_DEFECTO_BYTES,
    },
    ultimoAcceso: null,
    desactivadoEn: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };

  try {
    const { insertedId } = await usuarios().insertOne(documento);
    documento._id = insertedId;
  } catch (error) {
    throw traducirDuplicado(error);
  }

  await registrarActividad({
    accion: 'USUARIO_CREADO',
    categoria: 'usuarios',
    actor,
    usuarioAfectado: documento,
    detalles: { rol: documento.rol, cuotaBytes: documento.almacenamiento.cuotaBytes },
    ip,
  });
  return usuarioPublico(documento);
}

export async function actualizar(id, datos, actor, ip) {
  const usuario = await buscarOFallar(id);
  const cambios = {};
  const $set = {};

  for (const campo of ['correo', 'nombreCompleto', 'rol']) {
    if (datos[campo] !== undefined && datos[campo] !== usuario[campo]) {
      cambios[campo] = { antes: usuario[campo], despues: datos[campo] };
      $set[campo] = datos[campo];
    }
  }

  if (datos.cuotaMb !== undefined) {
    const cuotaBytes = datos.cuotaMb * MB;
    if (cuotaBytes !== usuario.almacenamiento.cuotaBytes) {
      if (cuotaBytes < usuario.almacenamiento.usadoBytes) {
        throw errores.conflicto(
          `La cuota no puede ser menor que el espacio que el usuario ya usa (${formatoMb(usuario.almacenamiento.usadoBytes)}).`,
        );
      }
      cambios.cuotaBytes = { antes: usuario.almacenamiento.cuotaBytes, despues: cuotaBytes };
      $set['almacenamiento.cuotaBytes'] = cuotaBytes;
    }
  }

  if (cambios.rol) {
    if (usuario._id.equals(actor._id)) {
      throw errores.conflicto('No puedes cambiar tu propio rol.');
    }
    if (cambios.rol.despues !== 'administrador' && (await esUltimoAdministradorActivo(usuario))) {
      throw errores.conflicto('No puedes quitar el rol al último administrador activo.');
    }
  }

  if (Object.keys($set).length === 0) return usuarioPublico(usuario);

  $set.actualizadoEn = new Date();
  // El rol viaja dentro del JWT: si cambia, se invalidan las sesiones abiertas de ese usuario.
  const actualizacion = cambios.rol ? { $set, $inc: { versionSesion: 1 } } : { $set };

  let actualizado;
  try {
    actualizado = await usuarios().findOneAndUpdate({ _id: usuario._id }, actualizacion, { returnDocument: 'after' });
  } catch (error) {
    throw traducirDuplicado(error);
  }

  await registrarActividad({
    accion: 'USUARIO_ACTUALIZADO',
    categoria: 'usuarios',
    actor,
    usuarioAfectado: actualizado,
    detalles: { cambios },
    ip,
  });
  return usuarioPublico(actualizado);
}

export async function cambiarEstado(id, activo, actor, ip) {
  const usuario = await buscarOFallar(id);
  if (usuario.activo === activo) return usuarioPublico(usuario);

  if (!activo) {
    if (usuario._id.equals(actor._id)) throw errores.conflicto('No puedes desactivar tu propia cuenta.');
    if (await esUltimoAdministradorActivo(usuario)) {
      throw errores.conflicto('No puedes desactivar al último administrador activo.');
    }
  }

  const ahora = new Date();
  const actualizacion = activo
    ? { $set: { activo: true, desactivadoEn: null, actualizadoEn: ahora } }
    : { $set: { activo: false, desactivadoEn: ahora, actualizadoEn: ahora }, $inc: { versionSesion: 1 } };
  const actualizado = await usuarios().findOneAndUpdate({ _id: usuario._id }, actualizacion, { returnDocument: 'after' });

  await registrarActividad({
    accion: activo ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO',
    categoria: 'usuarios',
    actor,
    usuarioAfectado: actualizado,
    ip,
  });
  return usuarioPublico(actualizado);
}

export async function restablecerClave(id, claveNueva, actor, ip) {
  const usuario = await buscarOFallar(id);
  const actualizado = await usuarios().findOneAndUpdate(
    { _id: usuario._id },
    { $set: { claveHash: await generarHash(claveNueva), actualizadoEn: new Date() }, $inc: { versionSesion: 1 } },
    { returnDocument: 'after' },
  );
  await registrarActividad({
    accion: 'USUARIO_CLAVE_RESTABLECIDA',
    categoria: 'usuarios',
    actor,
    usuarioAfectado: actualizado,
    ip,
  });
  return usuarioPublico(actualizado);
}

/** Usuarios activos (sin el propio) para elegir con quién compartir. Solo datos básicos. */
export async function directorio(buscar, usuarioActual) {
  const filtro = { activo: true, _id: { $ne: usuarioActual._id } };
  if (buscar) {
    const patron = patronSinTildes(buscar);
    filtro.$or = [{ nombreUsuario: patron }, { nombreCompleto: patron }, { correo: patron }];
  }
  return usuarios()
    .find(filtro, { projection: { nombreUsuario: 1, nombreCompleto: 1, correo: 1 } })
    .sort({ nombreCompleto: 1 })
    .limit(20)
    .toArray();
}
