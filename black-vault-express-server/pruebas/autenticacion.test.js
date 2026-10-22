import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prepararBaseDePruebas, crearApp, desconectar, crearUsuarioDirecto, iniciarSesion, coleccion, CLAVE_PRUEBA } from './apoyo.js';

describe('Autenticación', () => {
  let api;
  let maria;

  before(async () => {
    await prepararBaseDePruebas();
    api = request(crearApp());
    maria = await crearUsuarioDirecto({ nombreUsuario: 'mlopez', nombreCompleto: 'María Fernanda López' });
    await crearUsuarioDirecto({ nombreUsuario: 'pjuarez', activo: false, desactivadoEn: new Date() });
  });

  after(desconectar);

  it('inicia sesión con el nombre de usuario (sin importar mayúsculas)', async () => {
    const r = await api.post('/api/autenticacion/iniciar-sesion').send({ identificador: '  MLopez ', clave: CLAVE_PRUEBA }).expect(200);
    assert.ok(r.body.token);
    assert.ok(r.body.expiraEn);
    assert.equal(r.body.usuario.nombreUsuario, 'mlopez');
    assert.equal(r.body.usuario.claveHash, undefined, 'nunca se envía el hash');
    assert.equal(r.body.usuario.versionSesion, undefined);
    const contenido = jwt.decode(r.body.token);
    assert.equal(contenido.sub, maria._id.toString());
    assert.equal(contenido.rol, 'usuario');
  });

  it('inicia sesión con el correo y actualiza ultimoAcceso', async () => {
    await api.post('/api/autenticacion/iniciar-sesion').send({ identificador: 'mlopez@blackvault.gt', clave: CLAVE_PRUEBA }).expect(200);
    const u = await coleccion('usuarios').findOne({ _id: maria._id });
    assert.ok(u.ultimoAcceso instanceof Date);
  });

  it('responde lo mismo si el usuario no existe o si la clave es incorrecta', async () => {
    const a = await api.post('/api/autenticacion/iniciar-sesion').send({ identificador: 'noexiste', clave: 'Algo1234' }).expect(401);
    const b = await api.post('/api/autenticacion/iniciar-sesion').send({ identificador: 'mlopez', clave: 'Incorrecta1' }).expect(401);
    assert.deepEqual(a.body, b.body);
    assert.equal(a.body.error.codigo, 'CREDENCIALES_INVALIDAS');
  });

  it('registra los intentos fallidos sobre cuentas existentes', async () => {
    const fallidos = await coleccion('actividades').countDocuments({ accion: 'INICIO_SESION_FALLIDO', 'actor._id': maria._id });
    assert.ok(fallidos >= 1);
  });

  it('un usuario inactivo no puede entrar (403)', async () => {
    const r = await api.post('/api/autenticacion/iniciar-sesion').send({ identificador: 'pjuarez', clave: CLAVE_PRUEBA }).expect(403);
    assert.equal(r.body.error.codigo, 'USUARIO_INACTIVO');
  });

  it('rechaza campos desconocidos y datos faltantes', async () => {
    const r = await api.post('/api/autenticacion/iniciar-sesion').send({ identificador: 'mlopez' }).expect(400);
    assert.equal(r.body.error.codigo, 'VALIDACION');
    await api.post('/api/autenticacion/iniciar-sesion').send({ identificador: 'mlopez', clave: 'x', rol: 'administrador' }).expect(400);
  });

  it('impide la inyección de operadores de MongoDB en el login', async () => {
    await api.post('/api/autenticacion/iniciar-sesion').send({ identificador: { $ne: null }, clave: CLAVE_PRUEBA }).expect(400);
  });

  it('GET /perfil exige un token válido', async () => {
    await api.get('/api/autenticacion/perfil').expect(401);
    await api.get('/api/autenticacion/perfil').set('Authorization', 'Bearer basura').expect(401);
    const falso = jwt.sign({ rol: 'administrador', ver: 0 }, 'otro-secreto-cualquiera-de-32-caracteres!!', { subject: maria._id.toString() });
    await api.get('/api/autenticacion/perfil').set('Authorization', `Bearer ${falso}`).expect(401);
  });

  it('un token vencido responde SESION_EXPIRADA', async () => {
    const vencido = jwt.sign({ rol: 'usuario', ver: 0, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRETO, { subject: maria._id.toString() });
    const r = await api.get('/api/autenticacion/perfil').set('Authorization', `Bearer ${vencido}`).expect(401);
    assert.equal(r.body.error.codigo, 'SESION_EXPIRADA');
  });

  it('GET /perfil devuelve al usuario sin secretos', async () => {
    const token = await iniciarSesion(api, 'mlopez');
    const r = await api.get('/api/autenticacion/perfil').set('Authorization', `Bearer ${token}`).expect(200);
    assert.equal(r.body.nombreCompleto, 'María Fernanda López');
    assert.equal(r.body.claveHash, undefined);
    assert.ok(r.body.almacenamiento);
  });

  it('cambiar la clave: valida la actual, aplica la política e invalida las otras sesiones', async () => {
    const tokenA = await iniciarSesion(api, 'mlopez');
    const tokenB = await iniciarSesion(api, 'mlopez');

    const malaActual = await api.patch('/api/autenticacion/clave').set('Authorization', `Bearer ${tokenA}`)
      .send({ claveActual: 'NoEsEsta1', claveNueva: 'NuevaClave2026' }).expect(400);
    assert.equal(malaActual.body.error.codigo, 'CLAVE_ACTUAL_INCORRECTA');

    const debil = await api.patch('/api/autenticacion/clave').set('Authorization', `Bearer ${tokenA}`)
      .send({ claveActual: CLAVE_PRUEBA, claveNueva: 'solotexto' }).expect(400);
    assert.match(debil.body.error.detalles[0].mensaje, /letras y números/);

    const ok = await api.patch('/api/autenticacion/clave').set('Authorization', `Bearer ${tokenA}`)
      .send({ claveActual: CLAVE_PRUEBA, claveNueva: 'NuevaClave2026' }).expect(200);
    assert.ok(ok.body.token);

    await api.get('/api/autenticacion/perfil').set('Authorization', `Bearer ${tokenB}`).expect(401);
    await api.get('/api/autenticacion/perfil').set('Authorization', `Bearer ${ok.body.token}`).expect(200);
    await iniciarSesion(api, 'mlopez', 'NuevaClave2026');
    assert.equal(await coleccion('actividades').countDocuments({ accion: 'CLAVE_CAMBIADA' }), 1);
  });

  it('cerrar sesión queda en el historial', async () => {
    const token = await iniciarSesion(api, 'mlopez', 'NuevaClave2026');
    await api.post('/api/autenticacion/cerrar-sesion').set('Authorization', `Bearer ${token}`).expect(204);
    assert.equal(await coleccion('actividades').countDocuments({ accion: 'CIERRE_SESION' }), 1);
  });
});
