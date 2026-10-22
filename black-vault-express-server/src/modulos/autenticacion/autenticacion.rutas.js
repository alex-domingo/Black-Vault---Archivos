import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { entorno } from '../../config/entorno.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import { usuarioPublico } from '../usuarios/usuarios.servicio.js';
import * as esquemas from './autenticacion.esquemas.js';
import * as servicio from './autenticacion.servicio.js';

const rutas = Router();

// Frena los intentos de adivinar contraseñas: 10 intentos fallidos por IP cada 15 minutos.
const limitarIntentos = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => entorno.NODE_ENV === 'test',
  statusCode: 429,
  message: {
    error: { codigo: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.' },
  },
});

rutas.post('/iniciar-sesion', limitarIntentos, validar({ cuerpo: esquemas.cuerpoIniciarSesion }), async (req, res) => {
  res.json(await servicio.iniciarSesion(req.datos.cuerpo, req.ip));
});

rutas.post('/cerrar-sesion', autenticar, async (req, res) => {
  await servicio.cerrarSesion(req.usuario, req.ip);
  res.status(204).end();
});

rutas.get('/perfil', autenticar, (req, res) => {
  res.json(usuarioPublico(req.usuario));
});

rutas.patch('/clave', autenticar, validar({ cuerpo: esquemas.cuerpoCambiarClave }), async (req, res) => {
  res.json(await servicio.cambiarClave(req.usuario, req.datos.cuerpo, req.ip));
});

export default rutas;
