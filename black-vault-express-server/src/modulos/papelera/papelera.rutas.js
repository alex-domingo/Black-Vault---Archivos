import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as esquemas from './papelera.esquemas.js';
import * as servicio from './papelera.servicio.js';

// Cada usuario gestiona solo su propia papelera. Para enviar algo a ella:
// DELETE /api/archivos/:id y DELETE /api/carpetas/:id.
const rutas = Router();
rutas.use(autenticar);

rutas.get('/', validar({ consulta: esquemas.consultaListado }), async (req, res) => {
  res.json(await servicio.listar(req.usuario, req.datos.consulta));
});

rutas.post('/:tipo/:id/restaurar', validar({ parametros: esquemas.parametrosElemento }), async (req, res) => {
  const { tipo, id } = req.datos.parametros;
  res.json(await servicio.restaurar(req.usuario, tipo, id, req.ip));
});

rutas.delete('/:tipo/:id', validar({ parametros: esquemas.parametrosElemento }), async (req, res) => {
  const { tipo, id } = req.datos.parametros;
  res.json(await servicio.eliminarDefinitivo(req.usuario, tipo, id, req.ip));
});

rutas.delete('/', async (req, res) => {
  res.json(await servicio.vaciar(req.usuario, req.ip));
});

export default rutas;
