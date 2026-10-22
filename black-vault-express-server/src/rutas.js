// Registro de todos los módulos de la API bajo el prefijo /api.
import { Router } from 'express';
import rutasSalud from './modulos/salud/salud.rutas.js';
import rutasAutenticacion from './modulos/autenticacion/autenticacion.rutas.js';
import rutasUsuarios from './modulos/usuarios/usuarios.rutas.js';

const api = Router();

api.use('/salud', rutasSalud);
api.use('/autenticacion', rutasAutenticacion);
api.use('/usuarios', rutasUsuarios);
// Fases siguientes: carpetas, archivos, comparticiones, papelera, actividades,
// almacenamiento, reportes y mantenimiento.

export default api;
