// Valida cuerpo, parámetros de ruta y de consulta con zod.
// En Express 5 req.query es de solo lectura, así que los datos ya validados y
// convertidos se dejan en req.datos = { cuerpo, consulta, parametros }.
import { z } from 'zod';

/**
 * @param {{ cuerpo?: z.ZodType, consulta?: z.ZodType, parametros?: z.ZodType }} esquemas
 */
export function validar({ cuerpo, consulta, parametros } = {}) {
  return (req, res, next) => {
    req.datos = {
      cuerpo: cuerpo ? cuerpo.parse(req.body ?? {}) : undefined,
      consulta: consulta ? consulta.parse(req.query) : undefined,
      parametros: parametros ? parametros.parse(req.params) : undefined,
    };
    next();
  };
}

/** Atajo: z.object estricto (rechaza campos desconocidos). */
export const objeto = (forma) => z.strictObject(forma);
