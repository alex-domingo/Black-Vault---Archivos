import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';
import { recibirArchivo } from '../../middlewares/subida.js';
import { validar } from '../../middlewares/validar.js';
import * as esquemas from './archivos.esquemas.js';
import * as servicio from './archivos.servicio.js';

const rutas = Router();
rutas.use(autenticar);

rutas.get('/', validar({ consulta: esquemas.consultaBusqueda }), async (req, res) => {
  res.json(await servicio.buscar(req.usuario, req.datos.consulta));
});

// multipart/form-data: "archivo" + carpetaId, categoria, etiquetas, descripcion.
rutas.post('/', recibirArchivo, async (req, res) => {
  const campos = esquemas.camposSubida.parse(req.body ?? {});
  res.status(201).json(await servicio.subir(req.usuario, req.file, campos, req.ip));
});

rutas.get('/:id', validar({ parametros: esquemas.parametrosId }), async (req, res) => {
  res.json(await servicio.detalle(req.usuario, req.datos.parametros.id));
});

rutas.get('/:id/contenido', validar({ parametros: esquemas.parametrosId }), async (req, res) => {
  res.json(await servicio.leerTexto(req.usuario, req.datos.parametros.id, req.ip));
});

rutas.put(
  '/:id/contenido',
  validar({ parametros: esquemas.parametrosId, cuerpo: esquemas.cuerpoEditarContenido }),
  async (req, res) => {
    res.json(await servicio.editarTexto(req.usuario, req.datos.parametros.id, req.datos.cuerpo, req.ip));
  },
);

// Descarga byte a byte desde GridFS, sin pasar por el disco ni cargarlo completo en memoria.
rutas.get('/:id/descarga', validar({ parametros: esquemas.parametrosId }), async (req, res, next) => {
  const { archivo, flujo } = await servicio.prepararDescarga(req.usuario, req.datos.parametros.id, req.ip);
  res.attachment(archivo.nombre); // Content-Disposition con filename*=UTF-8'' para tildes y eñes
  res.type(archivo.tipoMime);
  res.set('Content-Length', String(archivo.contenido.bytes));
  res.set('X-Contenido-Sha256', archivo.contenido.sha256);
  flujo.on('error', (error) => {
    if (res.headersSent) res.destroy(error);
    else next(error);
  });
  flujo.pipe(res);
});

rutas.patch('/:id', validar({ parametros: esquemas.parametrosId, cuerpo: esquemas.cuerpoActualizar }), async (req, res) => {
  res.json(await servicio.actualizar(req.usuario, req.datos.parametros.id, req.datos.cuerpo, req.ip));
});

rutas.patch('/:id/mover', validar({ parametros: esquemas.parametrosId, cuerpo: esquemas.cuerpoMover }), async (req, res) => {
  res.json(await servicio.mover(req.usuario, req.datos.parametros.id, req.datos.cuerpo.destinoId, req.ip));
});

// Comentarios: verlos basta con lectura; agregarlos requiere el nivel "comentario".
rutas.get('/:id/comentarios', validar({ parametros: esquemas.parametrosId }), async (req, res) => {
  res.json(await servicio.listarComentarios(req.usuario, req.datos.parametros.id));
});

rutas.post(
  '/:id/comentarios',
  validar({ parametros: esquemas.parametrosId, cuerpo: esquemas.cuerpoComentario }),
  async (req, res) => {
    res.status(201).json(await servicio.agregarComentario(req.usuario, req.datos.parametros.id, req.datos.cuerpo.texto, req.ip));
  },
);

rutas.delete('/:id/comentarios/:comentarioId', validar({ parametros: esquemas.parametrosComentario }), async (req, res) => {
  const { id, comentarioId } = req.datos.parametros;
  await servicio.eliminarComentario(req.usuario, id, comentarioId, req.ip);
  res.status(204).end();
});

export default rutas;
