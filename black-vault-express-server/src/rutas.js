// Registro de todos los módulos de la API bajo el prefijo /api.
import { Router } from 'express';
import rutasSalud from './modulos/salud/salud.rutas.js';

const api = Router();

api.use('/salud', rutasSalud);
// Fase 2 en adelante: autenticacion, usuarios, carpetas, archivos, comparticiones,
// papelera, actividades, almacenamiento, reportes y mantenimiento.

export default api;
