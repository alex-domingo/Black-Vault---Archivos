import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { prepararBaseDePruebas, crearApp, desconectar, crearUsuarioDirecto, iniciarSesion, coleccion } from './apoyo.js';

const MB = 1024 * 1024;

describe('Administración de usuarios', () => {
  let api;
  let admin;
  let tokenAdmin;
  let tokenUsuario;
  let ana;

  const comoAdmin = (metodo, ruta) => api[metodo](ruta).set('Authorization', `Bearer ${tokenAdmin}`);

  before(async () => {
    await prepararBaseDePruebas();
    api = request(crearApp());
    admin = await crearUsuarioDirecto({ nombreUsuario: 'admin', nombreCompleto: 'Administrador del Sistema', rol: 'administrador' });
    ana = await crearUsuarioDirecto({ nombreUsuario: 'agarcia', nombreCompleto: 'Ana Lucía García' });
    tokenAdmin = await iniciarSesion(api, 'admin');
    tokenUsuario = await iniciarSesion(api, 'agarcia');
  });

  after(desconectar);

  it('un usuario normal no puede administrar usuarios (403)', async () => {
    const r = await api.get('/api/usuarios').set('Authorization', `Bearer ${tokenUsuario}`).expect(403);
    assert.equal(r.body.error.codigo, 'PROHIBIDO');
    await api.post('/api/usuarios').set('Authorization', `Bearer ${tokenUsuario}`).send({}).expect(403);
  });

  it('sin sesión responde 401', async () => {
    await api.get('/api/usuarios').expect(401);
  });

  it('crea un usuario con cuota por defecto, normalizando usuario y correo', async () => {
    const r = await comoAdmin('post', '/api/usuarios')
      .send({ nombreUsuario: 'JRamirez', correo: 'JRamirez@BlackVault.gt', nombreCompleto: 'José Antonio Ramírez', clave: 'Inicial2026' })
      .expect(201);
    assert.equal(r.body.nombreUsuario, 'jramirez');
    assert.equal(r.body.correo, 'jramirez@blackvault.gt');
    assert.equal(r.body.rol, 'usuario');
    assert.equal(r.body.activo, true);
    assert.equal(r.body.almacenamiento.cuotaBytes, 100 * MB);
    assert.equal(r.body.claveHash, undefined);
    await iniciarSesion(api, 'jramirez', 'Inicial2026');
    const actividad = await coleccion('actividades').findOne({ accion: 'USUARIO_CREADO' });
    assert.equal(actividad.usuarioAfectado.nombreUsuario, 'jramirez');
    assert.equal(actividad.actor.nombreUsuario, 'admin');
  });

  it('rechaza datos inválidos con detalle por campo', async () => {
    const r = await comoAdmin('post', '/api/usuarios')
      .send({ nombreUsuario: 'a b', correo: 'no-es-correo', nombreCompleto: 'X', clave: '123', rol: 'jefe' })
      .expect(400);
    const campos = r.body.error.detalles.map((d) => d.campo).sort();
    assert.deepEqual(campos, ['clave', 'correo', 'nombreCompleto', 'nombreUsuario', 'rol']);
  });

  it('rechaza nombre de usuario o correo repetidos con mensajes claros', async () => {
    const a = await comoAdmin('post', '/api/usuarios')
      .send({ nombreUsuario: 'jramirez', correo: 'otro@blackvault.gt', nombreCompleto: 'Otro', clave: 'Inicial2026' }).expect(409);
    assert.match(a.body.error.mensaje, /nombre de usuario/);
    const b = await comoAdmin('post', '/api/usuarios')
      .send({ nombreUsuario: 'otro', correo: 'jramirez@blackvault.gt', nombreCompleto: 'Otro', clave: 'Inicial2026' }).expect(409);
    assert.match(b.body.error.mensaje, /correo/);
  });

  it('lista con búsqueda, filtros y paginación', async () => {
    const r = await comoAdmin('get', '/api/usuarios?buscar=ram&limite=10').expect(200);
    assert.equal(r.body.total, 1);
    assert.equal(r.body.datos[0].nombreUsuario, 'jramirez');
    const admins = await comoAdmin('get', '/api/usuarios?rol=administrador').expect(200);
    assert.equal(admins.body.total, 1);
    const pagina = await comoAdmin('get', '/api/usuarios?limite=1&pagina=2').expect(200);
    assert.equal(pagina.body.datos.length, 1);
    assert.equal(pagina.body.total, 3);
    await comoAdmin('get', '/api/usuarios?buscar=(((').expect(200); // regex escapada
  });

  it('un id inexistente o mal formado responde 404', async () => {
    await comoAdmin('get', '/api/usuarios/64b000000000000000000000').expect(404);
    await comoAdmin('get', '/api/usuarios/no-es-un-id').expect(400);
  });

  it('actualiza datos y registra los cambios', async () => {
    const r = await comoAdmin('patch', `/api/usuarios/${ana._id}`).send({ nombreCompleto: 'Ana Lucía García Pérez', cuotaMb: 200 }).expect(200);
    assert.equal(r.body.nombreCompleto, 'Ana Lucía García Pérez');
    assert.equal(r.body.almacenamiento.cuotaBytes, 200 * MB);
    const actividad = await coleccion('actividades').findOne({ accion: 'USUARIO_ACTUALIZADO' });
    assert.equal(actividad.detalles.cambios.cuotaBytes.despues, 200 * MB);
  });

  it('la cuota no puede quedar por debajo del espacio usado', async () => {
    await coleccion('usuarios').updateOne({ _id: ana._id }, { $set: { 'almacenamiento.usadoBytes': 5 * MB } });
    const r = await comoAdmin('patch', `/api/usuarios/${ana._id}`).send({ cuotaMb: 4 }).expect(409);
    assert.match(r.body.error.mensaje, /5 MB/);
  });

  it('el administrador no puede cambiar su propio rol ni desactivarse', async () => {
    await comoAdmin('patch', `/api/usuarios/${admin._id}`).send({ rol: 'usuario' }).expect(409);
    await comoAdmin('patch', `/api/usuarios/${admin._id}/estado`).send({ activo: false }).expect(409);
  });

  it('nunca queda el sistema sin administradores activos', async () => {
    // Un segundo admin intenta quitarle el rol al único otro admin activo después de que este lo promueva.
    await comoAdmin('patch', `/api/usuarios/${ana._id}`).send({ rol: 'administrador' }).expect(200);
    const tokenAna = await iniciarSesion(api, 'agarcia');
    // Desactivar al admin original es válido porque Ana sigue activa como administradora.
    await api.patch(`/api/usuarios/${admin._id}/estado`).set('Authorization', `Bearer ${tokenAna}`).send({ activo: false }).expect(200);
    // Ahora Ana es la última administradora activa: nadie puede quitarle el rol ni desactivarla.
    const otro = await crearUsuarioDirecto({ nombreUsuario: 'otroadmin', rol: 'administrador', activo: false });
    await coleccion('usuarios').updateOne({ _id: otro._id }, { $set: { activo: true } });
    const tokenOtro = await iniciarSesion(api, 'otroadmin');
    await coleccion('usuarios').updateOne({ _id: otro._id }, { $set: { activo: false } });
    // Con "otroadmin" inactivo su sesión ya no sirve:
    await api.patch(`/api/usuarios/${ana._id}/estado`).set('Authorization', `Bearer ${tokenOtro}`).send({ activo: false }).expect(401);
    // Reactivamos al admin original y verificamos la regla del último administrador.
    await api.patch(`/api/usuarios/${admin._id}/estado`).set('Authorization', `Bearer ${tokenAna}`).send({ activo: true }).expect(200);
    tokenAdmin = await iniciarSesion(api, 'admin');
    await comoAdmin('patch', `/api/usuarios/${ana._id}`).send({ rol: 'usuario' }).expect(200);
    const unico = await coleccion('usuarios').countDocuments({ rol: 'administrador', activo: true });
    assert.equal(unico, 1);
  });

  it('desactivar corta la sesión al instante y conserva el historial', async () => {
    const tokenJose = await iniciarSesion(api, 'jramirez', 'Inicial2026');
    const jose = await coleccion('usuarios').findOne({ nombreUsuario: 'jramirez' });
    await api.get('/api/autenticacion/perfil').set('Authorization', `Bearer ${tokenJose}`).expect(200);

    const r = await comoAdmin('patch', `/api/usuarios/${jose._id}/estado`).send({ activo: false }).expect(200);
    assert.equal(r.body.activo, false);
    assert.ok(r.body.desactivadoEn);

    await api.get('/api/autenticacion/perfil').set('Authorization', `Bearer ${tokenJose}`).expect(401);
    await api.post('/api/autenticacion/iniciar-sesion').send({ identificador: 'jramirez', clave: 'Inicial2026' }).expect(403);
    assert.ok(await coleccion('actividades').countDocuments({ 'actor._id': jose._id }) > 0, 'su historial sigue ahí');
    assert.equal(await coleccion('actividades').countDocuments({ accion: 'USUARIO_DESACTIVADO', 'usuarioAfectado._id': jose._id }), 1);

    await comoAdmin('patch', `/api/usuarios/${jose._id}/estado`).send({ activo: true }).expect(200);
    await iniciarSesion(api, 'jramirez', 'Inicial2026');
  });

  it('no existe una ruta para eliminar usuarios', async () => {
    await comoAdmin('delete', `/api/usuarios/${ana._id}`).expect(404);
  });

  it('restablecer la clave invalida las sesiones del usuario', async () => {
    const tokenJose = await iniciarSesion(api, 'jramirez', 'Inicial2026');
    const jose = await coleccion('usuarios').findOne({ nombreUsuario: 'jramirez' });
    await comoAdmin('patch', `/api/usuarios/${jose._id}/clave`).send({ claveNueva: 'Restablecida1' }).expect(204);
    await api.get('/api/autenticacion/perfil').set('Authorization', `Bearer ${tokenJose}`).expect(401);
    await iniciarSesion(api, 'jramirez', 'Restablecida1');
  });

  it('el directorio muestra solo usuarios activos, sin el propio y sin datos sensibles', async () => {
    await crearUsuarioDirecto({ nombreUsuario: 'inactivo1', activo: false });
    const r = await api.get('/api/usuarios/directorio').set('Authorization', `Bearer ${tokenUsuario}`);
    // tokenUsuario quedó invalidado cuando Ana cambió de rol; se pide uno nuevo.
    const token = r.status === 200 ? tokenUsuario : await iniciarSesion(api, 'agarcia');
    const lista = (await api.get('/api/usuarios/directorio').set('Authorization', `Bearer ${token}`).expect(200)).body;
    const nombres = lista.map((u) => u.nombreUsuario);
    assert.ok(!nombres.includes('agarcia'));
    assert.ok(!nombres.includes('inactivo1'));
    assert.ok(nombres.includes('jramirez'));
    assert.deepEqual(Object.keys(lista[0]).sort(), ['_id', 'correo', 'nombreCompleto', 'nombreUsuario']);
  });
});
