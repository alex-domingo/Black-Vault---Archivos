// Papelera en cascada, restaurar, eliminar definitivamente y vaciar; historial e integridad.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { prepararBaseDePruebas, crearApp, desconectar, crearUsuarioDirecto, iniciarSesion, coleccion } from './apoyo.js';

describe('Papelera, historial e integridad', () => {
  let api;
  const u = {};
  const t = {};
  const id = {};
  const como = (quien) => (metodo, ruta) => api[metodo](ruta).set('Authorization', `Bearer ${t[quien]}`);
  const maria = como('maria');
  const jose = como('jose');
  const carlos = como('carlos');
  const admin = como('admin');

  const subir = (nombre, texto, carpetaId) => {
    let peticion = api
      .post('/api/archivos')
      .set('Authorization', `Bearer ${t.maria}`)
      .attach('archivo', Buffer.from(texto), { filename: nombre, contentType: 'text/plain' });
    if (carpetaId) peticion = peticion.field('carpetaId', carpetaId);
    return peticion.expect(201).then((r) => r.body._id);
  };
  const carpeta = (nombre, padreId) => maria('post', '/api/carpetas').send({ nombre, padreId }).expect(201).then((r) => r.body._id);
  const usado = async () => (await coleccion('usuarios').findOne({ _id: u.maria._id })).almacenamiento.usadoBytes;
  const doc = (col, idTexto) => coleccion(col).findOne({ _id: new ObjectId(idTexto) });
  const papelera = async () => (await maria('get', '/api/papelera').expect(200)).body;

  before(async () => {
    await prepararBaseDePruebas();
    api = request(crearApp());
    u.maria = await crearUsuarioDirecto({ nombreUsuario: 'mlopez', nombreCompleto: 'María Fernanda López' });
    u.jose = await crearUsuarioDirecto({ nombreUsuario: 'jramirez', nombreCompleto: 'José Antonio Ramírez' });
    u.carlos = await crearUsuarioDirecto({ nombreUsuario: 'cmorales', nombreCompleto: 'Carlos Eduardo Morales' });
    u.admin = await crearUsuarioDirecto({ nombreUsuario: 'admin', nombreCompleto: 'Administrador del Sistema', rol: 'administrador' });
    for (const [quien, usuario] of Object.entries(u)) t[quien] = await iniciarSesion(api, usuario.nombreUsuario);

    // María: Proyectos / Atlas / Entregables, compartida Atlas con José (edición).
    id.proyectos = await carpeta('Proyectos');
    id.atlas = await carpeta('Atlas', id.proyectos);
    id.entregables = await carpeta('Entregables', id.atlas);
    id.plan = await subir('Plan.md', '# Plan\n', id.atlas);
    id.entrega = await subir('Entrega.txt', 'Entrega final\n', id.entregables);
    id.nota = await subir('Nota.txt', 'Nota suelta\n');
    await maria('post', '/api/comparticiones')
      .send({ tipoRecurso: 'carpeta', recursoId: id.atlas, destinatarioId: String(u.jose._id), permiso: 'edicion' })
      .expect(201);
  });

  after(desconectar);

  describe('enviar a la papelera', () => {
    it('un archivo deja de verse, conserva su ubicación y sigue ocupando espacio', async () => {
      const antes = await usado();
      const r = await maria('delete', `/api/archivos/${id.nota}`).expect(200);
      assert.deepEqual(r.body.elementos, { carpetas: 0, archivos: 1 });
      await maria('get', `/api/archivos/${id.nota}`).expect(404);
      const raiz = await maria('get', '/api/carpetas/raiz/contenido').expect(200);
      assert.ok(!raiz.body.archivos.some((a) => a._id === id.nota));
      const busqueda = await maria('get', '/api/archivos?buscar=nota').expect(200);
      assert.equal(busqueda.body.total, 0);
      assert.equal(await usado(), antes); // I-10
      const espacio = await maria('get', '/api/almacenamiento').expect(200);
      assert.equal(espacio.body.enPapelera.archivos, 1);
      const enBd = await doc('archivos', id.nota);
      assert.equal(enBd.papelera.esRaiz, true);
      assert.equal(String(enBd.papelera.raizId), id.nota);
      assert.ok(await coleccion('actividades').findOne({ accion: 'ARCHIVO_ENVIADO_PAPELERA', 'recurso.nombre': 'Nota.txt' }));
      await maria('delete', `/api/archivos/${id.nota}`).expect(404); // ya estaba
    });

    it('solo el propietario envía a la papelera', async () => {
      const r = await jose('delete', `/api/archivos/${id.plan}`).expect(403);
      assert.match(r.body.error.mensaje, /Solo el propietario/);
      await jose('delete', `/api/carpetas/${id.entregables}`).expect(403);
      await carlos('delete', `/api/archivos/${id.plan}`).expect(404);
    });

    it('una carpeta se va con todo su contenido; lo eliminado antes conserva su propia raíz', async () => {
      await maria('delete', `/api/archivos/${id.entrega}`).expect(200);
      const r = await maria('delete', `/api/carpetas/${id.atlas}`).expect(200);
      assert.deepEqual(r.body.elementos, { carpetas: 2, archivos: 1 }); // Atlas, Entregables y Plan.md
      assert.equal(String((await doc('carpetas', id.entregables)).papelera.raizId), id.atlas);
      assert.equal((await doc('carpetas', id.entregables)).papelera.esRaiz, false);
      assert.equal(String((await doc('archivos', id.entrega)).papelera.raizId), id.entrega);
      // La ubicación no cambia: así se sabe dónde restaurar.
      assert.equal(String((await doc('carpetas', id.atlas)).padreId), id.proyectos);
    });

    it('lo compartido que está en la papelera deja de ser accesible', async () => {
      await jose('get', `/api/carpetas/${id.atlas}`).expect(404);
      await jose('get', `/api/archivos/${id.plan}/contenido`).expect(404);
      const conmigo = await jose('get', '/api/comparticiones/conmigo').expect(200);
      assert.equal(conmigo.body.total, 0);
      // La compartición sigue existiendo: al restaurar vuelve a tener efecto.
      assert.equal(await coleccion('comparticiones').countDocuments({ recursoId: new ObjectId(id.atlas) }), 1);
    });

    it('la papelera lista solo las raíces, con su contenido y su ubicación original', async () => {
      const lista = await papelera();
      assert.deepEqual(lista.datos.map((d) => d.recurso.nombre), ['Atlas', 'Entrega.txt', 'Nota.txt']);
      const atlas = lista.datos[0];
      assert.equal(atlas.tipo, 'carpeta');
      assert.deepEqual(atlas.contenido, { archivos: 1, carpetas: 1, bytes: Buffer.byteLength('# Plan\n') });
      assert.deepEqual(atlas.ubicacionOriginal, ['Proyectos']);
      assert.equal(atlas.restauraEnRaiz, false);
      const entrega = lista.datos[1];
      assert.deepEqual(entrega.ubicacionOriginal, ['Proyectos', 'Atlas', 'Entregables']);
      assert.equal(entrega.restauraEnRaiz, true); // su carpeta está en la papelera
      const soloCarpetas = (await maria('get', '/api/papelera?tipo=carpeta').expect(200)).body;
      assert.deepEqual(soloCarpetas.datos.map((d) => d.recurso.nombre), ['Atlas']);
      const vacia = (await jose('get', '/api/papelera').expect(200)).body;
      assert.equal(vacia.total, 0);
    });
  });

  describe('restaurar', () => {
    it('lo que se fue con una carpeta no se restaura por separado', async () => {
      const r = await maria('post', `/api/papelera/carpeta/${id.entregables}/restaurar`).expect(400);
      assert.match(r.body.error.mensaje, /junto con la carpeta "Atlas"/);
      await jose('post', `/api/papelera/carpeta/${id.atlas}/restaurar`).expect(404);
      await maria('post', `/api/papelera/archivo/${id.plan}/restaurar`).expect(400);
    });

    it('si su carpeta sigue en la papelera, el elemento vuelve a la raíz', async () => {
      const r = await maria('post', `/api/papelera/archivo/${id.entrega}/restaurar`).expect(200);
      assert.equal(r.body.alOrigen, false);
      assert.equal(r.body.destino, null);
      const enBd = await doc('archivos', id.entrega);
      assert.equal(enBd.carpetaId, null);
      assert.deepEqual(enBd.ancestros, []);
      assert.equal(enBd.enPapelera, false);
      const actividad = await coleccion('actividades').findOne({ accion: 'ARCHIVO_RESTAURADO' });
      assert.equal(actividad.detalles.alOrigen, false);
    });

    it('una carpeta vuelve a su lugar con su contenido y la compartición vuelve a valer', async () => {
      const r = await maria('post', `/api/papelera/carpeta/${id.atlas}/restaurar`).expect(200);
      assert.equal(r.body.alOrigen, true);
      assert.equal(r.body.destino.nombre, 'Proyectos');
      assert.deepEqual(r.body.elementos, { carpetas: 2, archivos: 1 });
      const dentro = await maria('get', `/api/carpetas/${id.atlas}/contenido`).expect(200);
      assert.deepEqual(dentro.body.carpetas.map((c) => c.nombre), ['Entregables']);
      assert.deepEqual(dentro.body.archivos.map((a) => a.nombre), ['Plan.md']);
      await jose('get', `/api/archivos/${id.plan}`).expect(200);
      assert.equal((await papelera()).total, 1); // queda Nota.txt
    });

    it('si el nombre ya está ocupado, se restaura con otro nombre', async () => {
      const nueva = await subir('Nota.txt', 'Otra nota\n');
      const r = await maria('post', `/api/papelera/archivo/${id.nota}/restaurar`).expect(200);
      assert.equal(r.body.nombre, 'Nota (1).txt');
      assert.equal(r.body.nombreAnterior, 'Nota.txt');
      const actividad = await coleccion('actividades').findOne({ accion: 'ARCHIVO_RESTAURADO', 'detalles.nombreAnterior': 'Nota.txt' });
      assert.ok(actividad);
      id.notaNueva = nueva;

      // Carpetas: el número va al final, sin confundir puntos con extensiones.
      const vieja = await carpeta('Versión 1.2');
      await maria('delete', `/api/carpetas/${vieja}`).expect(200);
      await carpeta('Versión 1.2');
      const c = await maria('post', `/api/papelera/carpeta/${vieja}/restaurar`).expect(200);
      assert.equal(c.body.nombre, 'Versión 1.2 (1)');
    });

    it('una carpeta interna que se restaura sola recalcula la ubicación de su contenido', async () => {
      id.viejo = await carpeta('Viejo', id.proyectos);
      id.dentroViejo = await subir('Dentro.txt', 'dentro\n', id.viejo);
      await maria('delete', `/api/carpetas/${id.viejo}`).expect(200);
      await maria('delete', `/api/carpetas/${id.proyectos}`).expect(200);
      await maria('post', `/api/papelera/carpeta/${id.viejo}/restaurar`).expect(200);
      assert.deepEqual((await doc('carpetas', id.viejo)).ancestros, []);
      assert.deepEqual((await doc('archivos', id.dentroViejo)).ancestros.map(String), [id.viejo]);
      await maria('post', `/api/papelera/carpeta/${id.proyectos}/restaurar`).expect(200);
    });
  });

  describe('eliminar definitivamente y vaciar', () => {
    it('un archivo: libera espacio, borra su contenido y sus comparticiones; el historial queda', async () => {
      await maria('post', '/api/comparticiones')
        .send({ tipoRecurso: 'archivo', recursoId: id.entrega, destinatarioId: String(u.carlos._id), permiso: 'lectura' })
        .expect(201);
      const archivo = await doc('archivos', id.entrega);
      await maria('delete', `/api/archivos/${id.entrega}`).expect(200);
      const antes = await usado();
      await maria('delete', `/api/papelera/archivo/${id.entregables}`).expect(404); // tipo equivocado
      const r = await maria('delete', `/api/papelera/archivo/${id.entrega}`).expect(200);
      assert.deepEqual({ archivos: r.body.archivos, carpetas: r.body.carpetas, bytes: r.body.bytes }, { archivos: 1, carpetas: 0, bytes: archivo.contenido.bytes });
      assert.equal(await usado(), antes - archivo.contenido.bytes);
      assert.equal(await doc('archivos', id.entrega), null);
      assert.equal(await coleccion('contenidos.files').countDocuments({ _id: archivo.contenido.gridFsId }), 0);
      assert.equal(await coleccion('contenidos.chunks').countDocuments({ files_id: archivo.contenido.gridFsId }), 0);
      assert.equal(await coleccion('comparticiones').countDocuments({ recursoId: archivo._id }), 0);
      assert.ok(await coleccion('actividades').findOne({ accion: 'ARCHIVO_SUBIDO', 'recurso._id': archivo._id })); // RN-07
      assert.ok(await coleccion('actividades').findOne({ accion: 'ARCHIVO_ELIMINADO_DEFINITIVO', 'recurso._id': archivo._id }));
    });

    it('solo se elimina lo que está en la papelera y es una raíz', async () => {
      await maria('delete', `/api/papelera/archivo/${id.plan}`).expect(404); // está activo
      await maria('delete', `/api/carpetas/${id.atlas}`).expect(200);
      await maria('delete', `/api/papelera/carpeta/${id.entregables}`).expect(400);
      await jose('delete', `/api/papelera/carpeta/${id.atlas}`).expect(404);
    });

    it('una carpeta: todo su subárbol, sus comparticiones y su espacio', async () => {
      const antes = await usado();
      const plan = await doc('archivos', id.plan);
      const r = await maria('delete', `/api/papelera/carpeta/${id.atlas}`).expect(200);
      assert.deepEqual({ archivos: r.body.archivos, carpetas: r.body.carpetas }, { archivos: 1, carpetas: 2 });
      assert.equal(await usado(), antes - plan.contenido.bytes);
      assert.equal(await doc('carpetas', id.entregables), null);
      assert.equal(await coleccion('comparticiones').countDocuments({ recursoId: new ObjectId(id.atlas) }), 0);
      await jose('get', `/api/carpetas/${id.atlas}`).expect(404);
    });

    it('vaciar elimina todo lo de la papelera del usuario', async () => {
      await maria('delete', `/api/archivos/${id.notaNueva}`).expect(200);
      await maria('delete', `/api/carpetas/${id.viejo}`).expect(200);
      const antes = await usado();
      const r = await maria('delete', '/api/papelera').expect(200);
      assert.deepEqual({ archivos: r.body.archivos, carpetas: r.body.carpetas }, { archivos: 2, carpetas: 1 });
      assert.equal(await usado(), antes - r.body.bytes);
      assert.equal((await papelera()).total, 0);
      const actividad = await coleccion('actividades').findOne({ accion: 'PAPELERA_VACIADA' });
      assert.equal(actividad.detalles.archivos, 2);
      // Vaciar una papelera vacía no registra nada.
      await maria('delete', '/api/papelera').expect(200);
      assert.equal(await coleccion('actividades').countDocuments({ accion: 'PAPELERA_VACIADA' }), 1);
    });
  });

  describe('historial', () => {
    it('cada usuario ve lo suyo, lo que otros hicieron con lo suyo y con él; sin IP', async () => {
      const todo = (await maria('get', '/api/actividades?limite=100').expect(200)).body;
      assert.ok(todo.total > 0);
      assert.ok(todo.datos.every((a) => !('ip' in a)));
      assert.ok(todo.datos.every((a) => a.actor.nombreUsuario === 'mlopez' || String(a.recurso?.propietarioId) === String(u.maria._id)));
      const mias = (await maria('get', '/api/actividades?alcance=mias&limite=100').expect(200)).body;
      assert.ok(mias.datos.every((a) => a.actor.nombreUsuario === 'mlopez'));

      const conJose = (await jose('get', '/api/actividades?alcance=conmigo').expect(200)).body;
      assert.deepEqual(conJose.datos.map((a) => a.accion), ['COMPARTICION_CREADA']);
      const deJose = (await jose('get', '/api/actividades').expect(200)).body;
      assert.ok(deJose.datos.some((a) => a.accion === 'COMPARTICION_CREADA'));
      assert.ok(!deJose.datos.some((a) => a.accion === 'ARCHIVO_SUBIDO')); // lo que María hizo con lo suyo no le incumbe
    });

    it('filtros por categoría, acción y fechas', async () => {
      const todo = (await maria('get', '/api/actividades').expect(200)).body;
      const papeleraCat = (await maria('get', '/api/actividades?categoria=papelera&limite=100').expect(200)).body;
      assert.ok(papeleraCat.total >= 8 && papeleraCat.datos.every((a) => a.categoria === 'papelera'));
      const restaurados = (await maria('get', '/api/actividades?accion=CARPETA_RESTAURADA').expect(200)).body;
      assert.equal(restaurados.total, 4);
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
      const deHoy = (await maria('get', `/api/actividades?desde=${hoy}&hasta=${hoy}`).expect(200)).body;
      assert.equal(deHoy.total, todo.total);
      await maria('get', '/api/actividades?desde=2026-10-10&hasta=2026-10-01').expect(400);
      await maria('get', '/api/actividades?accion=borrar todo').expect(400);
      const futuro = (await maria('get', '/api/actividades?desde=2099-01-01').expect(200)).body;
      assert.equal(futuro.total, 0);
    });

    it('solo el administrador filtra por usuario y ve la IP', async () => {
      await maria('get', `/api/actividades?usuarioId=${u.jose._id}`).expect(403);
      const r = (await admin('get', `/api/actividades?usuarioId=${u.jose._id}&limite=100`).expect(200)).body;
      assert.ok(r.total > 0 && r.datos.every((a) => a.actor.nombreUsuario === 'jramirez'));
      assert.ok('ip' in r.datos[0]);
      const global = (await admin('get', '/api/actividades').expect(200)).body;
      const deMaria = (await maria('get', '/api/actividades').expect(200)).body;
      assert.ok(global.total > deMaria.total);
    });

    it('la línea de tiempo de un recurso: propietario y administrador, aunque ya no exista', async () => {
      const proyectos = (await maria('get', `/api/actividades/recurso/carpeta/${id.proyectos}`).expect(200)).body;
      assert.equal(proyectos.datos.at(-1).accion, 'CARPETA_CREADA');
      assert.ok(proyectos.datos.every((a) => String(a.recurso._id) === id.proyectos));
      // Atlas ya fue eliminada definitivamente: su historial sigue disponible.
      const atlas = (await maria('get', `/api/actividades/recurso/carpeta/${id.atlas}`).expect(200)).body;
      assert.deepEqual(atlas.datos.map((a) => a.accion).slice(0, 2), ['CARPETA_ELIMINADA_DEFINITIVO', 'CARPETA_ENVIADA_PAPELERA']);
      await admin('get', `/api/actividades/recurso/carpeta/${id.atlas}`).expect(200);
      await jose('get', `/api/actividades/recurso/carpeta/${id.atlas}`).expect(404);
      await carlos('get', `/api/actividades/recurso/carpeta/${id.proyectos}`).expect(404);
    });

    it('quien tiene acceso compartido no ve la línea de tiempo (403)', async () => {
      const compartida = await carpeta('Compartida');
      await maria('post', '/api/comparticiones')
        .send({ tipoRecurso: 'carpeta', recursoId: compartida, destinatarioId: String(u.jose._id), permiso: 'lectura' })
        .expect(201);
      const r = await jose('get', `/api/actividades/recurso/carpeta/${compartida}`).expect(403);
      assert.match(r.body.error.mensaje, /Solo el propietario/);
    });
  });

  describe('verificación de integridad', () => {
    it('solo el administrador; la base queda íntegra después de todas las operaciones', async () => {
      await maria('get', '/api/mantenimiento/integridad').expect(403);
      const r = (await admin('get', '/api/mantenimiento/integridad').expect(200)).body;
      assert.equal(r.correcto, true, JSON.stringify(r.verificaciones.filter((v) => v.problemas)));
      assert.equal(r.verificaciones.length, 5);
    });

    it('detecta y repara un espacio mal calculado y contenido huérfano', async () => {
      const { repararIntegridad } = await import('../src/servicios/integridad.js');
      await coleccion('usuarios').updateOne({ _id: u.maria._id }, { $inc: { 'almacenamiento.usadoBytes': 123 } });
      await coleccion('contenidos.files').insertOne({ _id: new ObjectId(), length: 3, chunkSize: 261120, uploadDate: new Date(), filename: 'x.txt', metadata: {} });
      const mal = (await admin('get', '/api/mantenimiento/integridad').expect(200)).body;
      assert.equal(mal.correcto, false);
      const porClave = Object.fromEntries(mal.verificaciones.map((v) => [v.clave, v.problemas]));
      assert.deepEqual(porClave, { espacio: 1, papelera: 0, jerarquia: 0, contenido: 1, comparticiones: 0 });
      const { reparado, pendientes } = await repararIntegridad();
      assert.equal(reparado.espacio, 1);
      assert.equal(reparado.contenidoHuerfano, 1);
      assert.deepEqual(pendientes, []);
      const bien = (await admin('get', '/api/mantenimiento/integridad').expect(200)).body;
      assert.equal(bien.correcto, true);
    });
  });
});
