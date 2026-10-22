import { Router } from 'express';
import { autenticar, requerirRol } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './usuarios.controlador.js';
import * as esquemas from './usuarios.esquemas.js';

const rutas = Router();

rutas.use(autenticar);

// Cualquier usuario autenticado: lista de usuarios activos para compartir (fase 4).
rutas.get('/directorio', validar({ consulta: esquemas.consultaDirectorio }), controlador.directorio);

// A partir de aquí, solo administradores.
rutas.use(requerirRol('administrador'));

rutas.get('/', validar({ consulta: esquemas.consultaListado }), controlador.listar);
rutas.post('/', validar({ cuerpo: esquemas.cuerpoCrear }), controlador.crear);
rutas.get('/:id', validar({ parametros: esquemas.parametrosId }), controlador.obtener);
rutas.patch('/:id', validar({ parametros: esquemas.parametrosId, cuerpo: esquemas.cuerpoActualizar }), controlador.actualizar);
rutas.patch('/:id/estado', validar({ parametros: esquemas.parametrosId, cuerpo: esquemas.cuerpoEstado }), controlador.cambiarEstado);
rutas.patch(
  '/:id/clave',
  validar({ parametros: esquemas.parametrosId, cuerpo: esquemas.cuerpoRestablecerClave }),
  controlador.restablecerClave,
);

export default rutas;
