import { z } from 'zod';

/** Parámetros de consulta comunes: ?pagina=1&limite=20 (máximo 100). */
export const esquemaPaginacion = {
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
};

/** Convierte pagina/limite en skip/limit de MongoDB. */
export function aSkipLimit({ pagina, limite }) {
  return { skip: (pagina - 1) * limite, limit: limite };
}

/** Forma estándar de una respuesta paginada. */
export function respuestaPaginada(datos, total, { pagina, limite }) {
  return { datos, total, pagina, limite };
}
