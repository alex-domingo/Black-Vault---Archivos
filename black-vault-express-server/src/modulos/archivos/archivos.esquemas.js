import { z } from 'zod';
import { CATEGORIAS } from '../../bd/esquema.js';
import { objeto } from '../../middlewares/validar.js';
import { esquemaDia } from '../../utilidades/fechas.js';
import { esquemaId } from '../../utilidades/ids.js';
import { esquemaPaginacion } from '../../utilidades/paginacion.js';

export const parametrosId = objeto({ id: esquemaId });
export const parametrosComentario = objeto({ id: esquemaId, comentarioId: esquemaId });

const categoria = z.enum(CATEGORIAS, { error: 'La categoría debe ser administrativo, informe, contrato u otro.' });

/** Etiqueta normalizada: minúsculas, sin espacios repetidos, de 1 a 30 caracteres. */
const etiqueta = z
  .string()
  .transform((e) => e.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, 'Las etiquetas no pueden estar vacías.').max(30, 'Cada etiqueta admite como máximo 30 caracteres.'));

const listaEtiquetas = z
  .array(etiqueta)
  .max(20, 'Como máximo 20 etiquetas.')
  .transform((lista) => [...new Set(lista)]);

const descripcion = z.string().trim().max(500, 'La descripción admite como máximo 500 caracteres.');

/**
 * Campos de texto que acompañan la subida (multipart/form-data).
 * "etiquetas" puede llegar como JSON (["a","b"]) o separada por comas ("a, b").
 */
export const camposSubida = z.object({
  carpetaId: z.preprocess((v) => (v === '' || v === 'null' ? null : v), esquemaId.nullable().default(null)),
  categoria: z.preprocess((v) => (v === '' ? undefined : v), categoria.default('otro')),
  descripcion: z.preprocess((v) => v ?? '', descripcion),
  etiquetas: z.preprocess((v) => {
    if (v === undefined || v === '') return [];
    if (typeof v !== 'string') return v;
    const texto = v.trim();
    if (texto.startsWith('[')) {
      try {
        return JSON.parse(texto);
      } catch {
        return [texto];
      }
    }
    return texto.split(',').filter((e) => e.trim());
  }, listaEtiquetas),
});

export const consultaBusqueda = z
  .object({
    buscar: z.string().trim().max(200).optional(),
    texto: z.string().trim().max(200).optional(),
    tipo: z.enum(['txt', 'md']).optional(),
    categoria: categoria.optional(),
    etiqueta: z.string().trim().toLowerCase().max(30).optional(),
    carpetaId: esquemaId.optional(),
    desde: esquemaDia.optional(),
    hasta: esquemaDia.optional(),
    alcance: z.enum(['propios', 'compartidos', 'todos']).default('todos'),
    orden: z.enum(['nombre', 'fecha', 'tamano', 'tipo', 'relevancia']).default('fecha'),
    direccion: z.enum(['asc', 'desc']).default('desc'),
    ...esquemaPaginacion,
  })
  .refine((c) => !c.desde || !c.hasta || c.desde <= c.hasta, { message: '"desde" no puede ser posterior a "hasta".', path: ['desde'] });

export const cuerpoActualizar = objeto({
  nombre: z.string().max(300).optional(),
  categoria: categoria.optional(),
  etiquetas: listaEtiquetas.optional(),
  descripcion: descripcion.optional(),
}).refine((d) => Object.keys(d).length > 0, 'Indica al menos un dato para actualizar.');

export const cuerpoEditarContenido = objeto({
  contenido: z.string({ error: 'Falta el contenido.' }),
  versionEsperada: z.number({ error: 'Falta la versión que editaste (versionEsperada).' }).int().min(1),
});

export const cuerpoMover = objeto({
  destinoId: esquemaId.nullable(),
});

export const cuerpoComentario = objeto({
  texto: z
    .string({ error: 'Escribe el comentario.' })
    .transform((t) => t.normalize('NFC').trim())
    .pipe(z.string().min(1, 'Escribe el comentario.').max(1000, 'El comentario admite como máximo 1000 caracteres.')),
});
