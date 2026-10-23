import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as esquemas from './carpetas.esquemas.js';
import * as servicio from './carpetas.servicio.js';

const rutas = Router();
rutas.use(autenticar);

rutas.get('/raiz/contenido', validar({ consulta: esquemas.consultaContenido }), async (req, res) => {
  res.json(await servicio.contenidoRaiz(req.usuario, req.datos.consulta));
});

rutas.get('/arbol', async (req, res) => {
  res.json(await servicio.arbol(req.usuario));
});

rutas.post('/', validar({ cuerpo: esquemas.cuerpoCrear }), async (req, res) => {
  res.status(201).json(await servicio.crear(req.usuario, req.datos.cuerpo, req.ip));
});

rutas.get('/:id', validar({ parametros: esquemas.parametrosId }), async (req, res) => {
  res.json(await servicio.detalle(req.usuario, req.datos.parametros.id));
});

rutas.get(
  '/:id/contenido',
  validar({ parametros: esquemas.parametrosId, consulta: esquemas.consultaContenido }),
  async (req, res) => {
    res.json(await servicio.contenido(req.usuario, req.datos.parametros.id, req.datos.consulta));
  },
);

rutas.patch('/:id', validar({ parametros: esquemas.parametrosId, cuerpo: esquemas.cuerpoRenombrar }), async (req, res) => {
  res.json(await servicio.renombrar(req.usuario, req.datos.parametros.id, req.datos.cuerpo.nombre, req.ip));
});

rutas.patch('/:id/mover', validar({ parametros: esquemas.parametrosId, cuerpo: esquemas.cuerpoMover }), async (req, res) => {
  res.json(await servicio.mover(req.usuario, req.datos.parametros.id, req.datos.cuerpo.destinoId, req.ip));
});

export default rutas;
