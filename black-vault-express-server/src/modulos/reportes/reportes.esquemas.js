import { z } from 'zod';
import { CATEGORIAS_ACTIVIDAD, EXTENSIONES, TIPOS_RECURSO } from '../../bd/esquema.js';
import { objeto } from '../../middlewares/validar.js';
import { esquemaDia } from '../../utilidades/fechas.js';
import { esquemaId } from '../../utilidades/ids.js';
import { esquemaPaginacion } from '../../utilidades/paginacion.js';

const rango = {
  desde: esquemaDia.optional(),
  hasta: esquemaDia.optional(),
};
const rangoValido = (c) => !c.desde || !c.hasta || c.desde <= c.hasta;
const mensajeRango = { message: '"desde" no puede ser posterior a "hasta".', path: ['desde'] };

/** Cuántos elementos muestra un ranking (Top N). */
const top = z.coerce.number().int().min(1, 'El límite mínimo es 1.').max(50, 'El límite máximo es 50.').default(10);
const incluirPapelera = z.stringbool({ error: 'incluirPapelera debe ser true o false.' }).default(false);

export const parametrosUsuario = objeto({ usuarioId: esquemaId });

export const consultaArchivosPorTipo = z.object({ ...rango, incluirPapelera }).refine(rangoValido, mensajeRango);

export const consultaArchivosPorFecha = z
  .object({ ...rango, incluirPapelera, tipo: z.enum(EXTENSIONES).optional(), ...esquemaPaginacion })
  .refine(rangoValido, mensajeRango);

export const consultaRanking = z.object({ ...rango, limite: top }).refine(rangoValido, mensajeRango);

export const consultaUsuariosMasArchivos = z.object({ limite: top, tipo: z.enum(EXTENSIONES).optional() });

export const consultaComparticionesDeUsuario = z.object({ tipo: z.enum(TIPOS_RECURSO).optional(), ...esquemaPaginacion });

export const consultaActividadUsuario = z
  .object({ ...rango, categoria: z.enum(CATEGORIAS_ACTIVIDAD).optional(), ...esquemaPaginacion })
  .refine(rangoValido, mensajeRango);

export const consultaPorTipo = z.object({ ...rango }).refine(rangoValido, mensajeRango);

export const consultaPorPeriodo = z
  .object({ ...rango, unidad: z.enum(['dia', 'semana', 'mes']).default('mes'), categoria: z.enum(CATEGORIAS_ACTIVIDAD).optional() })
  .refine(rangoValido, mensajeRango);
