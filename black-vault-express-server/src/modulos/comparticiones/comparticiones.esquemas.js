import { z } from 'zod';
import { PERMISOS, TIPOS_RECURSO } from '../../bd/esquema.js';
import { objeto } from '../../middlewares/validar.js';
import { esquemaId } from '../../utilidades/ids.js';
import { esquemaPaginacion } from '../../utilidades/paginacion.js';

const permiso = z.enum(PERMISOS, { error: 'El permiso debe ser lectura, comentario o edicion.' });
const tipoRecurso = z.enum(TIPOS_RECURSO, { error: 'El tipo de recurso debe ser archivo o carpeta.' });

export const parametrosId = objeto({ id: esquemaId });
export const parametrosRecurso = objeto({ tipo: tipoRecurso, id: esquemaId });

export const cuerpoCrear = objeto({
  tipoRecurso,
  recursoId: esquemaId,
  destinatarioId: esquemaId,
  permiso,
});

export const cuerpoModificar = objeto({ permiso });

export const consultaListado = z.object({
  tipo: tipoRecurso.optional(),
  buscar: z.string().trim().max(200).optional(),
  ...esquemaPaginacion,
});
