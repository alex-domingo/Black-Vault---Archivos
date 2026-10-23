import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as esquemas from './comparticiones.esquemas.js';
import * as servicio from './comparticiones.servicio.js';

const rutas = Router();
rutas.use(autenticar);

// Lo que otros compartieron conmigo y lo que yo compartí.
rutas.get('/conmigo', validar({ consulta: esquemas.consultaListado }), async (req, res) => {
  res.json(await servicio.conmigo(req.usuario, req.datos.consulta));
});

rutas.get('/realizadas', validar({ consulta: esquemas.consultaListado }), async (req, res) => {
  res.json(await servicio.realizadas(req.usuario, req.datos.consulta));
});

// Quién tiene acceso a un recurso (directo y heredado). Solo el propietario.
rutas.get('/recurso/:tipo/:id', validar({ parametros: esquemas.parametrosRecurso }), async (req, res) => {
  const { tipo, id } = req.datos.parametros;
  res.json(await servicio.accesoDeRecurso(req.usuario, tipo, id));
});

rutas.post('/', validar({ cuerpo: esquemas.cuerpoCrear }), async (req, res) => {
  res.status(201).json(await servicio.crear(req.usuario, req.datos.cuerpo, req.ip));
});

rutas.patch('/:id', validar({ parametros: esquemas.parametrosId, cuerpo: esquemas.cuerpoModificar }), async (req, res) => {
  res.json(await servicio.modificar(req.usuario, req.datos.parametros.id, req.datos.cuerpo.permiso, req.ip));
});

rutas.delete('/:id', validar({ parametros: esquemas.parametrosId }), async (req, res) => {
  await servicio.retirar(req.usuario, req.datos.parametros.id, req.ip);
  res.status(204).end();
});

export default rutas;
