import { z } from 'zod';
import { TIPOS_RECURSO } from '../../bd/esquema.js';
import { objeto } from '../../middlewares/validar.js';
import { esquemaId } from '../../utilidades/ids.js';
import { esquemaPaginacion } from '../../utilidades/paginacion.js';

const tipo = z.enum(TIPOS_RECURSO, { error: 'El tipo debe ser archivo o carpeta.' });

export const parametrosElemento = objeto({ tipo, id: esquemaId });

export const consultaListado = z.object({
  tipo: tipo.optional(),
  buscar: z.string().trim().max(200).optional(),
  ...esquemaPaginacion,
});
