import { z } from 'zod';
import { ROLES } from '../../bd/esquema.js';
import { esquemaClave } from '../../servicios/claves.js';
import { objeto } from '../../middlewares/validar.js';
import { esquemaId } from '../../utilidades/ids.js';
import { esquemaPaginacion } from '../../utilidades/paginacion.js';

export const nombreUsuario = z
  .string({ error: 'El nombre de usuario es obligatorio.' })
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, 'Entre 3 y 30 caracteres: letras sin tilde, números, punto, guion o guion bajo.');

export const correo = z
  .string({ error: 'El correo es obligatorio.' })
  .trim()
  .toLowerCase()
  .max(254, 'El correo es demasiado largo.')
  .pipe(z.email('El correo no es válido.'));

export const nombreCompleto = z
  .string({ error: 'El nombre completo es obligatorio.' })
  .trim()
  .min(3, 'El nombre completo debe tener al menos 3 caracteres.')
  .max(100, 'El nombre completo no puede superar 100 caracteres.');

const rol = z.enum(ROLES, { error: 'El rol debe ser administrador o usuario.' });

/** Cuota en MB (de 1 MB a 100 GB). Se guarda en bytes. */
const cuotaMb = z
  .number({ error: 'La cuota debe ser un número de MB.' })
  .int('La cuota debe ser un número entero de MB.')
  .min(1, 'La cuota mínima es 1 MB.')
  .max(102_400, 'La cuota máxima es 100 GB.');

export const parametrosId = objeto({ id: esquemaId });

export const consultaListado = z.object({
  buscar: z.string().trim().max(100).optional(),
  rol: rol.optional(),
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  ...esquemaPaginacion,
});

export const cuerpoCrear = objeto({
  nombreUsuario,
  correo,
  nombreCompleto,
  rol: rol.default('usuario'),
  clave: esquemaClave,
  cuotaMb: cuotaMb.optional(),
});

export const cuerpoActualizar = objeto({
  correo: correo.optional(),
  nombreCompleto: nombreCompleto.optional(),
  rol: rol.optional(),
  cuotaMb: cuotaMb.optional(),
}).refine((datos) => Object.keys(datos).length > 0, 'Indica al menos un dato para actualizar.');

export const cuerpoEstado = objeto({ activo: z.boolean({ error: 'Indica si el usuario queda activo (true) o inactivo (false).' }) });

export const cuerpoRestablecerClave = objeto({ claveNueva: esquemaClave });

export const consultaDirectorio = z.object({
  buscar: z.string().trim().max(100).optional(),
});
