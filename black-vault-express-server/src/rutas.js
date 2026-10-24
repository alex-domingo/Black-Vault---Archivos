// Registro de todos los módulos de la API bajo el prefijo /api.
import { Router } from 'express';
import rutasSalud from './modulos/salud/salud.rutas.js';
import rutasAutenticacion from './modulos/autenticacion/autenticacion.rutas.js';
import rutasUsuarios from './modulos/usuarios/usuarios.rutas.js';
import rutasCarpetas from './modulos/carpetas/carpetas.rutas.js';
import rutasArchivos from './modulos/archivos/archivos.rutas.js';
import rutasAlmacenamiento from './modulos/almacenamiento/almacenamiento.rutas.js';
import rutasComparticiones from './modulos/comparticiones/comparticiones.rutas.js';
import rutasPapelera from './modulos/papelera/papelera.rutas.js';
import rutasActividades from './modulos/actividades/actividades.rutas.js';
import rutasMantenimiento from './modulos/mantenimiento/mantenimiento.rutas.js';

import rutasReportes from './modulos/reportes/reportes.rutas.js';
const api = Router();

api.use('/salud', rutasSalud);
api.use('/autenticacion', rutasAutenticacion);
api.use('/usuarios', rutasUsuarios);
api.use('/carpetas', rutasCarpetas);
api.use('/archivos', rutasArchivos);
api.use('/almacenamiento', rutasAlmacenamiento);
api.use('/comparticiones', rutasComparticiones);
api.use('/papelera', rutasPapelera);
api.use('/actividades', rutasActividades);
api.use('/mantenimiento', rutasMantenimiento);
api.use('/reportes', rutasReportes);

export default api;
