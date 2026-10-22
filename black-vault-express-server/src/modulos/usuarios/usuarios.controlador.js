import * as servicio from './usuarios.servicio.js';

export async function listar(req, res) {
  res.json(await servicio.listar(req.datos.consulta));
}

export async function obtener(req, res) {
  res.json(await servicio.obtener(req.datos.parametros.id));
}

export async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.datos.cuerpo, req.usuario, req.ip));
}

export async function actualizar(req, res) {
  res.json(await servicio.actualizar(req.datos.parametros.id, req.datos.cuerpo, req.usuario, req.ip));
}

export async function cambiarEstado(req, res) {
  res.json(await servicio.cambiarEstado(req.datos.parametros.id, req.datos.cuerpo.activo, req.usuario, req.ip));
}

export async function restablecerClave(req, res) {
  await servicio.restablecerClave(req.datos.parametros.id, req.datos.cuerpo.claveNueva, req.usuario, req.ip);
  res.status(204).end();
}

export async function directorio(req, res) {
  res.json(await servicio.directorio(req.datos.consulta.buscar, req.usuario));
}
