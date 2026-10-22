import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { prepararBaseDePruebas, crearApp, desconectar } from './apoyo.js';

describe('API base', () => {
  let app;

  before(async () => {
    await prepararBaseDePruebas();
    app = crearApp();
  });

  after(desconectar);

  it('GET /api/salud informa el estado de MongoDB', async () => {
    const respuesta = await request(app).get('/api/salud').expect(200);
    assert.equal(respuesta.body.estado, 'ok');
    assert.equal(respuesta.body.baseDatos.conectada, true);
    assert.equal(respuesta.body.baseDatos.nombre, 'black_vault_pruebas');
    assert.equal(typeof respuesta.body.baseDatos.transacciones, 'boolean');
    assert.match(respuesta.body.baseDatos.version, /^\d+\.\d+/);
  });

  it('una ruta inexistente responde 404 con el formato de error', async () => {
    const respuesta = await request(app).get('/api/no-existe').expect(404);
    assert.equal(respuesta.body.error.codigo, 'RUTA_NO_ENCONTRADA');
    assert.match(respuesta.body.error.mensaje, /GET \/api\/no-existe/);
  });

  it('un JSON mal formado responde 400 VALIDACION', async () => {
    const respuesta = await request(app)
      .post('/api/salud')
      .set('Content-Type', 'application/json')
      .send('{"mal": ')
      .expect(400);
    assert.equal(respuesta.body.error.codigo, 'VALIDACION');
  });

  it('CORS permite el cliente Angular y expone Content-Disposition', async () => {
    const respuesta = await request(app).get('/api/salud').set('Origin', 'http://localhost:4200');
    assert.equal(respuesta.headers['access-control-allow-origin'], 'http://localhost:4200');
    assert.match(respuesta.headers['access-control-expose-headers'], /Content-Disposition/);
  });

  it('CORS no autoriza otros orígenes', async () => {
    const respuesta = await request(app).get('/api/salud').set('Origin', 'http://sitio-ajeno.com');
    assert.equal(respuesta.headers['access-control-allow-origin'], undefined);
  });
});
