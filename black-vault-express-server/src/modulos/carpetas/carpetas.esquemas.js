import { z } from 'zod';
import { objeto } from '../../middlewares/validar.js';
import { esquemaId } from '../../utilidades/ids.js';

export const parametrosId = objeto({ id: esquemaId });

export const consultaContenido = z.object({
  orden: z.enum(['nombre', 'fecha', 'tamano', 'tipo']).default('nombre'),
  direccion: z.enum(['asc', 'desc']).default('asc'),
});

export const cuerpoCrear = objeto({
  nombre: z.string({ error: 'El nombre de la carpeta es obligatorio.' }).max(300),
  padreId: esquemaId.nullable().default(null),
});

export const cuerpoRenombrar = objeto({
  nombre: z.string({ error: 'El nombre es obligatorio.' }).max(300),
});

export const cuerpoMover = objeto({
  // null = mover a la raíz de "Mi unidad".
  destinoId: esquemaId.nullable(),
});
