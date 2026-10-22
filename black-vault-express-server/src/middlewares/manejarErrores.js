// Respuesta 404 para rutas inexistentes y manejador central de errores.
// En Express 5 los errores (y las promesas rechazadas) de cualquier handler llegan aquí solos.
import { MongoServerError } from 'mongodb';
import { ZodError } from 'zod';
import { entorno } from '../config/entorno.js';
import { ErrorApi } from '../utilidades/errores.js';

export function rutaNoEncontrada(req, res) {
  res.status(404).json({
    error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: `No existe la ruta ${req.method} ${req.originalUrl}.` },
  });
}

/** Convierte cualquier error en { estado, cuerpo } con el formato uniforme de la API. */
export function traducirError(error) {
  if (error instanceof ErrorApi) {
    return { estado: error.estado, codigo: error.codigo, mensaje: error.message, detalles: error.detalles };
  }

  if (error instanceof ZodError) {
    const detalles = error.issues.map((problema) => ({ campo: problema.path.join('.'), mensaje: problema.message }));
    return { estado: 400, codigo: 'VALIDACION', mensaje: 'Los datos enviados no son válidos.', detalles };
  }

  // Errores del lector de JSON de Express (body-parser).
  if (error?.type === 'entity.parse.failed') {
    return { estado: 400, codigo: 'VALIDACION', mensaje: 'El cuerpo de la petición no es un JSON válido.' };
  }
  if (error?.type === 'entity.too.large') {
    return { estado: 413, codigo: 'CUERPO_DEMASIADO_GRANDE', mensaje: 'El cuerpo de la petición es demasiado grande.' };
  }

  if (error instanceof MongoServerError && error.code === 11000) {
    return { estado: 409, codigo: 'CONFLICTO', mensaje: 'Ya existe un registro con esos datos.', detalles: error.keyValue };
  }

  return { estado: 500, codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado en el servidor.' };
}

// Express reconoce un manejador de errores porque recibe 4 parámetros.
// eslint-disable-next-line no-unused-vars
export function manejarErrores(error, req, res, next) {
  const { estado, codigo, mensaje, detalles } = traducirError(error);

  if (estado >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, error);
  }

  const cuerpo = { error: { codigo, mensaje } };
  if (detalles !== undefined) cuerpo.error.detalles = detalles;
  // En desarrollo, el mensaje técnico ayuda a depurar; en producción nunca se expone.
  if (estado >= 500 && entorno.NODE_ENV === 'development') cuerpo.error.tecnico = error?.message;

  res.status(estado).json(cuerpo);
}
