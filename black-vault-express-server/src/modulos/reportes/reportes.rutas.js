import { Router } from 'express';
import { autenticar, requerirRol } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as esquemas from './reportes.esquemas.js';
import * as servicio from './reportes.servicio.js';

// Todos los reportes son solo para el administrador (RF-15, RF-16).
const rutas = Router();
rutas.use(autenticar, requerirRol('administrador'));

const consulta = (esquema, funcion) => [validar({ consulta: esquema }), async (req, res) => res.json(await funcion(req.datos.consulta))];
const deUsuario = (esquema, funcion) => [
  validar({ parametros: esquemas.parametrosUsuario, consulta: esquema }),
  async (req, res) => res.json(await funcion(req.datos.parametros.usuarioId, req.datos.consulta)),
];

rutas.get('/resumen', async (req, res) => res.json(await servicio.resumen()));

rutas.get('/archivos-por-tipo', ...consulta(esquemas.consultaArchivosPorTipo, servicio.archivosPorTipo)); // RR-01
rutas.get('/archivos-por-fecha', ...consulta(esquemas.consultaArchivosPorFecha, servicio.archivosPorFecha)); // RR-02
rutas.get('/archivos-mas-operaciones', ...consulta(esquemas.consultaRanking, servicio.archivosMasOperaciones)); // RR-03
rutas.get('/usuarios-mas-archivos', ...consulta(esquemas.consultaUsuariosMasArchivos, servicio.usuariosMasArchivos)); // RR-04
rutas.get('/usuarios-mas-compartidos', ...consulta(esquemas.consultaRanking, servicio.usuariosMasCompartidos)); // RR-05
rutas.get('/archivos-mas-compartidos', ...consulta(esquemas.consultaRanking, servicio.archivosMasCompartidos)); // RR-06
rutas.get('/compartidos-por-usuario/:usuarioId', ...deUsuario(esquemas.consultaComparticionesDeUsuario, servicio.compartidosPorUsuario)); // RR-07
rutas.get('/recibidos-por-usuario/:usuarioId', ...deUsuario(esquemas.consultaComparticionesDeUsuario, servicio.recibidosPorUsuario)); // RR-08
rutas.get('/actividad-usuario/:usuarioId', ...deUsuario(esquemas.consultaActividadUsuario, servicio.actividadUsuario)); // RR-09
rutas.get('/operaciones-por-tipo', ...consulta(esquemas.consultaPorTipo, servicio.operacionesPorTipo)); // RR-10
rutas.get('/operaciones-por-periodo', ...consulta(esquemas.consultaPorPeriodo, servicio.operacionesPorPeriodo)); // RR-11
rutas.get('/principales-acciones', ...consulta(esquemas.consultaRanking, servicio.principalesAcciones)); // RR-12

export default rutas;
