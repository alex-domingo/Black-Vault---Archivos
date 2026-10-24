import { Router } from 'express';
import { z } from 'zod';
import { CATEGORIAS_ACTIVIDAD, TIPOS_RECURSO } from '../../bd/esquema.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { objeto, validar } from '../../middlewares/validar.js';
import { esquemaDia } from '../../utilidades/fechas.js';
import { esquemaId } from '../../utilidades/ids.js';
import { esquemaPaginacion } from '../../utilidades/paginacion.js';
import * as servicio from './actividades.servicio.js';

const filtros = {
  categoria: z.enum(CATEGORIAS_ACTIVIDAD).optional(),
  accion: z.string().regex(/^[A-Z]+(_[A-Z]+)*$/, 'La acción no es válida.').optional(),
  desde: esquemaDia.optional(),
  hasta: esquemaDia.optional(),
  ...esquemaPaginacion,
};
const rangoValido = (c) => !c.desde || !c.hasta || c.desde <= c.hasta;
const mensajeRango = { message: '"desde" no puede ser posterior a "hasta".', path: ['desde'] };

const consultaListado = z
  .object({
    ...filtros,
    alcance: z.enum(['todo', 'mias', 'mis-recursos', 'conmigo']).default('todo'),
    usuarioId: esquemaId.optional(),
  })
  .refine(rangoValido, mensajeRango);
const consultaRecurso = z.object(filtros).refine(rangoValido, mensajeRango);
const parametrosRecurso = objeto({ tipo: z.enum(TIPOS_RECURSO), id: esquemaId });

const rutas = Router();
rutas.use(autenticar);

rutas.get('/', validar({ consulta: consultaListado }), async (req, res) => {
  res.json(await servicio.listar(req.usuario, req.datos.consulta));
});

rutas.get('/recurso/:tipo/:id', validar({ parametros: parametrosRecurso, consulta: consultaRecurso }), async (req, res) => {
  const { tipo, id } = req.datos.parametros;
  res.json(await servicio.deRecurso(req.usuario, tipo, id, req.datos.consulta));
});

export default rutas;
