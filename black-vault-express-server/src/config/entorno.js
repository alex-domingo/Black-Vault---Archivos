// Variables de entorno validadas al arrancar.
// Node 24 las carga desde .env con --env-file-if-exists (ver scripts de package.json).
import { z } from 'zod';

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PUERTO: z.coerce.number().int().min(1).max(65535).default(8000),
  // Se usa 127.0.0.1 y no "localhost": en Windows, Node puede resolver localhost a ::1
  // mientras mongod solo escucha en 127.0.0.1.
  URI_MONGODB: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\/.+\/[^/?]+/, 'Debe ser una URI de MongoDB que incluya el nombre de la base, por ejemplo mongodb://127.0.0.1:27017/black_vault')
    .default('mongodb://127.0.0.1:27017/black_vault'),
  // Orígenes permitidos por CORS, separados por comas.
  ORIGEN_CLIENTE: z.string().min(1).default('http://localhost:4200'),
  ZONA_HORARIA: z.string().min(1).default('America/Guatemala'),
  TAMANO_MAXIMO_MB: z.coerce.number().positive().max(15).default(5),
  CUOTA_POR_DEFECTO_MB: z.coerce.number().positive().default(100),
});

const resultado = esquemaEntorno.safeParse(process.env);

if (!resultado.success) {
  console.error('Configuración inválida en las variables de entorno:\n' + z.prettifyError(resultado.error));
  process.exit(1);
}

export const entorno = Object.freeze({
  ...resultado.data,
  ORIGENES_CLIENTE: resultado.data.ORIGEN_CLIENTE.split(',').map((origen) => origen.trim()).filter(Boolean),
  TAMANO_MAXIMO_BYTES: Math.floor(resultado.data.TAMANO_MAXIMO_MB * 1024 * 1024),
  CUOTA_POR_DEFECTO_BYTES: Math.floor(resultado.data.CUOTA_POR_DEFECTO_MB * 1024 * 1024),
});

/** Devuelve la URI sin usuario ni contraseña, para mostrarla en mensajes. */
export function uriSinCredenciales(uri) {
  return uri.replace(/\/\/[^@/]+@/, '//***@');
}
