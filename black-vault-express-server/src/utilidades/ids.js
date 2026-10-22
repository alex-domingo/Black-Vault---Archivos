import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { errores } from './errores.js';

/** Esquema zod para un id de MongoDB recibido como texto (24 caracteres hexadecimales). */
export const esquemaId = z.string().regex(/^[a-f\d]{24}$/i, 'El identificador no es válido.');

/**
 * Convierte un texto en ObjectId. Si no es un id válido responde 404: para quien
 * consulta, un id mal formado es simplemente un recurso que no existe.
 */
export function aObjectId(valor, mensaje) {
  if (valor instanceof ObjectId) return valor;
  if (typeof valor !== 'string' || !ObjectId.isValid(valor) || valor.length !== 24) {
    throw errores.noEncontrado(mensaje);
  }
  return new ObjectId(valor);
}
