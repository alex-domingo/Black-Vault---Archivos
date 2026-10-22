// GET /api/salud: estado del servidor y de MongoDB. Es público y sirve para que
// el cliente compruebe que la API responde.
import { Router } from 'express';
import { entorno } from '../../config/entorno.js';
import { estadoBaseDatos } from '../../bd/conexion.js';

const rutas = Router();

rutas.get('/', async (req, res) => {
  const baseDatos = await estadoBaseDatos();
  res.status(baseDatos.conectada ? 200 : 503).json({
    estado: baseDatos.conectada ? 'ok' : 'degradado',
    servidor: {
      nombre: 'Black Vault API',
      node: process.version,
      entorno: entorno.NODE_ENV,
      zonaHoraria: entorno.ZONA_HORARIA,
      activoDesdeSeg: Math.round(process.uptime()),
    },
    baseDatos,
    fecha: new Date().toISOString(),
  });
});

export default rutas;
