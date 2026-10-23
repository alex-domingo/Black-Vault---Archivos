// Compartir, herencia de permisos y comentarios: la matriz de la sección 3 del diseño, completa.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { prepararBaseDePruebas, crearApp, desconectar, crearUsuarioDirecto, iniciarSesion, coleccion } from './apoyo.js';

describe('Comparticiones y comentarios', () => {
  let api;
  const u = {}; // usuarios
  const t = {}; // tokens
  const id = {}; // recursos
  const como = (quien) => (metodo, ruta) => api[metodo](ruta).set('Authorization', `Bearer ${t[quien]}`);
  const maria = como('maria');
  const jose = como('jose');
  const ana = como('ana');
  const carlos = como('carlos');
  const admin = como('admin');

  const subir = (quien, nombre, texto, carpetaId) => {
    let peticion = api
      .post('/api/archivos')
      .set('Authorization', `Bearer ${t[quien]}`)
      .attach('archivo', Buffer.from(texto), { filename: nombre, contentType: 'text/plain' });
    if (carpetaId) peticion = peticion.field('carpetaId', carpetaId);
    return peticion;
  };
  const compartir = (tipoRecurso, recursoId, destinatario, permiso) =>
    maria('post', '/api/comparticiones').send({ tipoRecurso, recursoId, destinatarioId: String(u[destinatario]._id), permiso });
  const usado = async (quien) => (await coleccion('usuarios').findOne({ _id: u[quien]._id })).almacenamiento.usadoBytes;

  before(async () => {
    await prepararBaseDePruebas();
    api = request(crearApp());
    u.maria = await crearUsuarioDirecto({ nombreUsuario: 'mlopez', nombreCompleto: 'María Fernanda López' });
    u.jose = await crearUsuarioDirecto({ nombreUsuario: 'jramirez', nombreCompleto: 'José Antonio Ramírez' });
    u.ana = await crearUsuarioDirecto({ nombreUsuario: 'agarcia', nombreCompleto: 'Ana Lucía García' });
    u.carlos = await crearUsuarioDirecto({ nombreUsuario: 'cmorales', nombreCompleto: 'Carlos Eduardo Morales' });
    u.paola = await crearUsuarioDirecto({ nombreUsuario: 'pjuarez', nombreCompleto: 'Paola Juárez Estrada', activo: false, desactivadoEn: new Date() });
    u.admin = await crearUsuarioDirecto({ nombreUsuario: 'admin', nombreCompleto: 'Administrador del Sistema', rol: 'administrador' });
    for (const [quien, usuario] of Object.entries(u)) {
      if (quien !== 'paola') t[quien] = await iniciarSesion(api, usuario.nombreUsuario);
    }

    // María: Proyectos / Atlas / Entregables, con archivos en cada nivel y una carpeta privada.
    id.proyectos = (await maria('post', '/api/carpetas').send({ nombre: 'Proyectos' }).expect(201)).body._id;
    id.atlas = (await maria('post', '/api/carpetas').send({ nombre: 'Atlas', padreId: id.proyectos }).expect(201)).body._id;
    id.entregables = (await maria('post', '/api/carpetas').send({ nombre: 'Entregables', padreId: id.atlas }).expect(201)).body._id;
    id.privada = (await maria('post', '/api/carpetas').send({ nombre: 'Privada' }).expect(201)).body._id;
    id.plan = (await subir('maria', 'Plan.md', '# Plan del proyecto\n', id.atlas).expect(201)).body._id;
    id.entrega = (await subir('maria', 'Entrega final.txt', 'Contenido de la entrega\n', id.entregables).expect(201)).body._id;
    id.secreto = (await subir('maria', 'Secreto.txt', 'Nadie más lo ve\n', id.privada).expect(201)).body._id;
  });

  after(desconectar);

  describe('crear, modificar y retirar', () => {
    it('el propietario comparte carpetas y archivos con los tres niveles', async () => {
      const r = await compartir('carpeta', id.atlas, 'jose', 'edicion').expect(201);
      assert.equal(r.body.permiso, 'edicion');
      assert.equal(r.body.destinatario.nombreUsuario, 'jramirez');
      id.compartirAtlasJose = r.body._id;
      id.compartirProyectosAna = (await compartir('carpeta', id.proyectos, 'ana', 'lectura').expect(201)).body._id;
      id.compartirPlanAna = (await compartir('archivo', id.plan, 'ana', 'comentario').expect(201)).body._id;
      id.compartirEntregaCarlos = (await compartir('archivo', id.entrega, 'carlos', 'lectura').expect(201)).body._id;

      const actividad = await coleccion('actividades').findOne({ accion: 'COMPARTICION_CREADA', 'usuarioAfectado.nombreUsuario': 'jramirez' });
      assert.equal(actividad.categoria, 'comparticiones');
      assert.equal(actividad.recurso.nombre, 'Atlas');
      assert.equal(actividad.detalles.permiso, 'edicion');
    });

    it('no comparte dos veces con la misma persona: indica qué compartición modificar', async () => {
      const r = await compartir('carpeta', id.atlas, 'jose', 'lectura').expect(409);
      assert.match(r.body.error.mensaje, /ya está compartido con José Antonio Ramírez/);
      assert.equal(r.body.error.detalles.comparticionId, id.compartirAtlasJose);
    });

    it('rechaza compartir consigo mismo, con usuarios inactivos o inexistentes y permisos inválidos', async () => {
      const conMaria = await compartir('carpeta', id.atlas, 'maria', 'lectura').expect(400);
      assert.match(conMaria.body.error.mensaje, /contigo mismo/);
      const inactiva = await compartir('carpeta', id.atlas, 'paola', 'lectura').expect(409);
      assert.match(inactiva.body.error.mensaje, /desactivada/);
      await maria('post', '/api/comparticiones')
        .send({ tipoRecurso: 'carpeta', recursoId: id.atlas, destinatarioId: String(new ObjectId()), permiso: 'lectura' })
        .expect(404);
      await compartir('carpeta', id.atlas, 'carlos', 'propietario').expect(400);
      await compartir('carpeta', id.atlas, 'carlos', 'escritura').expect(400);
      // El tipo debe corresponder al recurso: un archivo no se encuentra como carpeta.
      await compartir('carpeta', id.plan, 'carlos', 'lectura').expect(404);
    });

    it('modifica el permiso y lo registra; sin cambios no registra nada', async () => {
      const r = await maria('patch', `/api/comparticiones/${id.compartirEntregaCarlos}`).send({ permiso: 'comentario' }).expect(200);
      assert.equal(r.body.permiso, 'comentario');
      const actividad = await coleccion('actividades').findOne({ accion: 'COMPARTICION_MODIFICADA' });
      assert.deepEqual(actividad.detalles, { permisoAnterior: 'lectura', permisoNuevo: 'comentario' });
      await maria('patch', `/api/comparticiones/${id.compartirEntregaCarlos}`).send({ permiso: 'comentario' }).expect(200);
      assert.equal(await coleccion('actividades').countDocuments({ accion: 'COMPARTICION_MODIFICADA' }), 1);
      await maria('patch', `/api/comparticiones/${id.compartirEntregaCarlos}`).send({ permiso: 'lectura' }).expect(200);
    });

    it('nadie más que el propietario crea, modifica o retira comparticiones', async () => {
      // José tiene edición en Atlas, pero compartir es solo del propietario.
      const r = await jose('post', '/api/comparticiones')
        .send({ tipoRecurso: 'archivo', recursoId: id.plan, destinatarioId: String(u.carlos._id), permiso: 'lectura' })
        .expect(403);
      assert.match(r.body.error.mensaje, /Solo el propietario/);
      // Sobre comparticiones ajenas responde 404: no se revela que existen.
      await jose('patch', `/api/comparticiones/${id.compartirPlanAna}`).send({ permiso: 'edicion' }).expect(404);
      await ana('delete', `/api/comparticiones/${id.compartirPlanAna}`).expect(404);
      // Sin acceso al recurso: 404.
      await carlos('post', '/api/comparticiones')
        .send({ tipoRecurso: 'carpeta', recursoId: id.privada, destinatarioId: String(u.ana._id), permiso: 'lectura' })
        .expect(404);
    });
  });

  describe('permiso efectivo y herencia', () => {
    const acceso = async (cliente, tipo, recursoId) => {
      const ruta = tipo === 'archivo' ? `/api/archivos/${recursoId}` : `/api/carpetas/${recursoId}`;
      const r = await cliente('get', ruta);
      return r.status === 200 ? r.body.acceso : r.status;
    };

    it('una carpeta compartida da acceso a todo su contenido', async () => {
      assert.equal(await acceso(jose, 'carpeta', id.atlas), 'edicion');
      assert.equal(await acceso(jose, 'carpeta', id.entregables), 'edicion');
      assert.equal(await acceso(jose, 'archivo', id.entrega), 'edicion');
      assert.equal(await acceso(ana, 'archivo', id.entrega), 'lectura');
    });

    it('el permiso efectivo es el mayor entre el directo y el heredado', async () => {
      // Ana: lectura por Proyectos y comentario directo sobre Plan.md.
      assert.equal(await acceso(ana, 'archivo', id.plan), 'comentario');
      assert.equal(await acceso(ana, 'carpeta', id.atlas), 'lectura');
    });

    it('sin compartición la respuesta es 404, también para el administrador', async () => {
      assert.equal(await acceso(jose, 'carpeta', id.proyectos), 404);
      assert.equal(await acceso(jose, 'carpeta', id.privada), 404);
      assert.equal(await acceso(carlos, 'archivo', id.plan), 404);
      assert.equal(await acceso(carlos, 'carpeta', id.entregables), 404);
      assert.equal(await acceso(admin, 'archivo', id.secreto), 404);
      await admin('get', `/api/archivos/${id.secreto}/contenido`).expect(404);
    });

    it('la ruta empieza en la carpeta compartida más alta: nunca muestra carpetas privadas', async () => {
      const deJose = await jose('get', `/api/carpetas/${id.entregables}/contenido`).expect(200);
      assert.deepEqual(deJose.body.ruta.map((r) => r.nombre), ['Atlas', 'Entregables']);
      const deAna = await ana('get', `/api/carpetas/${id.entregables}/contenido`).expect(200);
      assert.deepEqual(deAna.body.ruta.map((r) => r.nombre), ['Proyectos', 'Atlas', 'Entregables']);
      const deCarlos = await carlos('get', `/api/archivos/${id.entrega}`).expect(200);
      assert.deepEqual(deCarlos.body.ruta, []);
    });

    it('lo compartido aparece en la búsqueda; lo privado no', async () => {
      const r = await jose('get', '/api/archivos?alcance=compartidos').expect(200);
      assert.deepEqual(r.body.datos.map((a) => a.nombre).sort(), ['Entrega final.txt', 'Plan.md']);
      assert.ok(r.body.datos.every((a) => a.esPropio === false && a.propietario.nombreUsuario === 'mlopez'));
      const deCarlos = await carlos('get', '/api/archivos?alcance=todos').expect(200);
      assert.deepEqual(deCarlos.body.datos.map((a) => a.nombre), ['Entrega final.txt']);
    });
  });

  describe('matriz de permisos (sección 3)', () => {
    it('ver, vista previa y descarga: cualquier nivel', async () => {
      for (const cliente of [maria, jose, ana]) {
        await cliente('get', `/api/archivos/${id.plan}/contenido`).expect(200);
        await cliente('get', `/api/archivos/${id.plan}/descarga`).expect(200);
      }
      await carlos('get', `/api/archivos/${id.entrega}/descarga`).expect(200);
      await carlos('get', `/api/archivos/${id.plan}/descarga`).expect(404);
    });

    it('editar contenido, renombrar y clasificar: propietario y edición', async () => {
      const version = (await jose('get', `/api/archivos/${id.plan}/contenido`)).body.version;
      await jose('put', `/api/archivos/${id.plan}/contenido`).send({ contenido: '# Plan revisado\n', versionEsperada: version }).expect(200);
      await jose('patch', `/api/archivos/${id.plan}`).send({ etiquetas: ['atlas'] }).expect(200);
      await jose('patch', `/api/carpetas/${id.entregables}`).send({ nombre: 'Entregas' }).expect(200);
      await maria('patch', `/api/carpetas/${id.entregables}`).send({ nombre: 'Entregables' }).expect(200);

      const comentario = await ana('put', `/api/archivos/${id.plan}/contenido`).send({ contenido: 'x', versionEsperada: version + 1 }).expect(403);
      assert.match(comentario.body.error.mensaje, /comentar/);
      await ana('patch', `/api/archivos/${id.plan}`).send({ nombre: 'Otro' }).expect(403);
      await ana('patch', `/api/carpetas/${id.atlas}`).send({ nombre: 'Otro' }).expect(403);
      await carlos('patch', `/api/archivos/${id.entrega}`).send({ categoria: 'informe' }).expect(403);
    });

    it('subir y crear subcarpetas en una carpeta compartida: edición; lo creado es del propietario', async () => {
      const antesMaria = await usado('maria');
      const antesJose = await usado('jose');
      const texto = 'Hola desde José\n';
      const r = await subir('jose', 'Aporte de José.txt', texto, id.atlas).expect(201);
      assert.equal(r.body.propietarioId, String(u.maria._id));
      assert.equal(r.body.creadoPor, String(u.jose._id));
      assert.equal(await usado('maria'), antesMaria + Buffer.byteLength(texto));
      assert.equal(await usado('jose'), antesJose);
      const sub = await jose('post', '/api/carpetas').send({ nombre: 'Borradores', padreId: id.atlas }).expect(201);
      assert.equal(sub.body.propietarioId, String(u.maria._id));

      await subir('ana', 'Intento.txt', 'no\n', id.atlas).expect(403);
      await ana('post', '/api/carpetas').send({ nombre: 'Intento', padreId: id.atlas }).expect(403);
      await subir('carlos', 'Intento.txt', 'no\n', id.atlas).expect(404);
    });

    it('mover: solo el propietario', async () => {
      const r = await jose('patch', `/api/archivos/${id.plan}/mover`).send({ destinoId: id.entregables }).expect(403);
      assert.match(r.body.error.mensaje, /Solo el propietario/);
      await jose('patch', `/api/carpetas/${id.entregables}/mover`).send({ destinoId: null }).expect(403);
    });

    it('ver quién tiene acceso: solo el propietario, con lo directo y lo heredado', async () => {
      const r = await maria('get', `/api/comparticiones/recurso/archivo/${id.plan}`).expect(200);
      assert.deepEqual(r.body.directas.map((c) => [c.destinatario.nombreUsuario, c.permiso]), [['agarcia', 'comentario']]);
      assert.deepEqual(
        r.body.heredadas.map((c) => [c.destinatario.nombreUsuario, c.permiso, c.desde.nombre]),
        [['agarcia', 'lectura', 'Proyectos'], ['jramirez', 'edicion', 'Atlas']],
      );
      await jose('get', `/api/comparticiones/recurso/archivo/${id.plan}`).expect(403);
      await carlos('get', `/api/comparticiones/recurso/archivo/${id.plan}`).expect(404);
    });

    it('solo el propietario ve qué está compartido y con cuántas personas', async () => {
      const raiz = await maria('get', '/api/carpetas/raiz/contenido').expect(200);
      const marcas = Object.fromEntries(raiz.body.carpetas.map((c) => [c.nombre, c.compartido]));
      assert.deepEqual(marcas, { Privada: false, Proyectos: true });
      const detalle = await maria('get', `/api/archivos/${id.plan}`).expect(200);
      assert.equal(detalle.body.compartidoCon, 1);
      const deJose = await jose('get', `/api/carpetas/${id.atlas}/contenido`).expect(200);
      assert.ok(deJose.body.archivos.every((a) => !('compartido' in a)));
      const detalleJose = await jose('get', `/api/archivos/${id.plan}`).expect(200);
      assert.ok(!('compartidoCon' in detalleJose.body));
    });
  });

  describe('comentarios', () => {
    it('agregar: comentario, edición y propietario; lectura no', async () => {
      const deAna = await ana('post', `/api/archivos/${id.plan}/comentarios`).send({ texto: '  Revisar el alcance.  ' }).expect(201);
      assert.equal(deAna.body.texto, 'Revisar el alcance.');
      assert.equal(deAna.body.autor.nombreUsuario, 'agarcia');
      id.comentarioAna = deAna.body._id;
      id.comentarioJose = (await jose('post', `/api/archivos/${id.plan}/comentarios`).send({ texto: 'De acuerdo.' }).expect(201)).body._id;
      id.comentarioMaria = (await maria('post', `/api/archivos/${id.plan}/comentarios`).send({ texto: 'Lo reviso.' }).expect(201)).body._id;

      const r = await carlos('post', `/api/archivos/${id.entrega}/comentarios`).send({ texto: 'Hola' }).expect(403);
      assert.match(r.body.error.mensaje, /lectura/);
      await carlos('post', `/api/archivos/${id.plan}/comentarios`).send({ texto: 'Hola' }).expect(404);
      const actividad = await coleccion('actividades').findOne({ accion: 'COMENTARIO_AGREGADO', 'actor.nombreUsuario': 'agarcia' });
      assert.equal(actividad.detalles.extracto, 'Revisar el alcance.');
    });

    it('valida el texto: de 1 a 1000 caracteres', async () => {
      await ana('post', `/api/archivos/${id.plan}/comentarios`).send({ texto: '   ' }).expect(400);
      await ana('post', `/api/archivos/${id.plan}/comentarios`).send({ texto: 'x'.repeat(1001) }).expect(400);
      await ana('post', `/api/archivos/${id.plan}/comentarios`).send({}).expect(400);
    });

    it('ver comentarios: cualquier nivel; cada uno indica si se puede eliminar', async () => {
      const r = await ana('get', `/api/archivos/${id.plan}/comentarios`).expect(200);
      assert.deepEqual(r.body.comentarios.map((c) => c.texto), ['Revisar el alcance.', 'De acuerdo.', 'Lo reviso.']);
      assert.deepEqual(r.body.comentarios.map((c) => c.puedeEliminar), [true, false, false]);
      assert.equal(r.body.puedeComentar, true);
      const deDueña = await maria('get', `/api/archivos/${id.plan}/comentarios`).expect(200);
      assert.ok(deDueña.body.comentarios.every((c) => c.puedeEliminar));
      const deCarlos = await carlos('get', `/api/archivos/${id.entrega}/comentarios`).expect(200);
      assert.equal(deCarlos.body.puedeComentar, false);
      // Los listados nunca traen los comentarios.
      const lista = await maria('get', `/api/carpetas/${id.atlas}/contenido`).expect(200);
      assert.ok(lista.body.archivos.every((a) => !('comentarios' in a)));
    });

    it('eliminar: el autor el suyo; el propietario cualquiera', async () => {
      const r = await ana('delete', `/api/archivos/${id.plan}/comentarios/${id.comentarioJose}`).expect(403);
      assert.match(r.body.error.mensaje, /tus propios comentarios/);
      await jose('delete', `/api/archivos/${id.plan}/comentarios/${id.comentarioJose}`).expect(204);
      await maria('delete', `/api/archivos/${id.plan}/comentarios/${id.comentarioAna}`).expect(204);
      await maria('delete', `/api/archivos/${id.plan}/comentarios/${id.comentarioAna}`).expect(404);
      await maria('delete', `/api/archivos/${id.plan}/comentarios/${new ObjectId()}`).expect(404);
      const quedan = await maria('get', `/api/archivos/${id.plan}/comentarios`).expect(200);
      assert.deepEqual(quedan.body.comentarios.map((c) => c.texto), ['Lo reviso.']);
      const actividad = await coleccion('actividades').findOne({ accion: 'COMENTARIO_ELIMINADO', 'actor.nombreUsuario': 'mlopez' });
      assert.equal(actividad.usuarioAfectado.nombreUsuario, 'agarcia');
    });

    it('quien bajó a lectura conserva el derecho a borrar sus propios comentarios', async () => {
      const propio = (await ana('post', `/api/archivos/${id.plan}/comentarios`).send({ texto: 'Mío' }).expect(201)).body._id;
      await maria('patch', `/api/comparticiones/${id.compartirPlanAna}`).send({ permiso: 'lectura' }).expect(200);
      await ana('post', `/api/archivos/${id.plan}/comentarios`).send({ texto: 'Ya no' }).expect(403);
      await ana('delete', `/api/archivos/${id.plan}/comentarios/${propio}`).expect(204);
      await maria('patch', `/api/comparticiones/${id.compartirPlanAna}`).send({ permiso: 'comentario' }).expect(200);
    });

    it('respeta el tope de 200 comentarios de forma atómica', async () => {
      const relleno = Array.from({ length: 198 }, (_, i) => ({
        _id: new ObjectId(),
        autor: { _id: u.maria._id, nombreUsuario: 'mlopez', nombreCompleto: 'María Fernanda López' },
        texto: `Relleno ${i}`,
        creadoEn: new Date(),
      }));
      await coleccion('archivos').updateOne({ _id: new ObjectId(id.plan) }, { $push: { comentarios: { $each: relleno } } });
      await ana('post', `/api/archivos/${id.plan}/comentarios`).send({ texto: 'El número 200' }).expect(201);
      const r = await ana('post', `/api/archivos/${id.plan}/comentarios`).send({ texto: 'El 201' }).expect(409);
      assert.match(r.body.error.mensaje, /límite de 200/);
      await coleccion('archivos').updateOne({ _id: new ObjectId(id.plan) }, { $set: { comentarios: [] } });
    });
  });

  describe('vistas de compartidos', () => {
    it('el directorio para compartir encuentra personas sin importar las tildes', async () => {
      const r = await maria('get', '/api/usuarios/directorio?buscar=garcia').expect(200);
      assert.deepEqual(r.body.map((p) => p.nombreUsuario), ['agarcia']);
      const conTilde = await maria('get', '/api/usuarios/directorio?buscar=Ramírez').expect(200);
      assert.deepEqual(conTilde.body.map((p) => p.nombreUsuario), ['jramirez']);
      const inactiva = await maria('get', '/api/usuarios/directorio?buscar=juarez').expect(200);
      assert.equal(inactiva.body.length, 0);
    });

    it('"conmigo" lista lo compartido directamente, con propietario y permiso', async () => {
      const r = await ana('get', '/api/comparticiones/conmigo').expect(200);
      assert.equal(r.body.total, 2);
      const vistos = r.body.datos.map((c) => [c.tipoRecurso, c.recurso.nombre, c.permiso, c.propietario.nombreUsuario]);
      assert.deepEqual(vistos.sort(), [['archivo', 'Plan.md', 'comentario', 'mlopez'], ['carpeta', 'Proyectos', 'lectura', 'mlopez']]);
      const soloArchivos = await ana('get', '/api/comparticiones/conmigo?tipo=archivo').expect(200);
      assert.deepEqual(soloArchivos.body.datos.map((c) => c.recurso.nombre), ['Plan.md']);
      const buscando = await ana('get', '/api/comparticiones/conmigo?buscar=proyécto').expect(200);
      assert.deepEqual(buscando.body.datos.map((c) => c.recurso.nombre), ['Proyectos']);
      assert.ok(!('comentarios' in r.body.datos[0].recurso) && !('gridFsId' in r.body.datos[0].recurso));
    });

    it('"realizadas" agrupa por recurso con las personas que tienen acceso directo', async () => {
      await compartir('archivo', id.plan, 'carlos', 'lectura').expect(201);
      const r = await maria('get', '/api/comparticiones/realizadas').expect(200);
      assert.equal(r.body.total, 4);
      const plan = r.body.datos.find((g) => g.recurso.nombre === 'Plan.md');
      assert.deepEqual(plan.comparticiones.map((c) => [c.destinatario.nombreUsuario, c.permiso]), [['agarcia', 'comentario'], ['cmorales', 'lectura']]);
      assert.equal(r.body.datos[0].recurso.nombre, 'Plan.md'); // el cambio más reciente primero
      const deJose = await jose('get', '/api/comparticiones/realizadas').expect(200);
      assert.equal(deJose.body.total, 0);
    });

    it('lo que está en la papelera no aparece ni es accesible para el destinatario', async () => {
      const papelera = { enviadoEn: new Date(), enviadoPor: u.maria._id, raizId: new ObjectId(id.entrega), esRaiz: true };
      await coleccion('archivos').updateOne({ _id: new ObjectId(id.entrega) }, { $set: { enPapelera: true, papelera } });
      await carlos('get', `/api/archivos/${id.entrega}`).expect(404);
      const r = await carlos('get', '/api/comparticiones/conmigo').expect(200);
      assert.deepEqual(r.body.datos.map((c) => c.recurso.nombre), ['Plan.md']);
      // Compartir algo que está en la papelera no es posible; cambiar el permiso tampoco.
      await compartir('archivo', id.entrega, 'ana', 'lectura').expect(404);
      await maria('patch', `/api/comparticiones/${id.compartirEntregaCarlos}`).send({ permiso: 'edicion' }).expect(409);
      await coleccion('archivos').updateOne({ _id: new ObjectId(id.entrega) }, { $set: { enPapelera: false, papelera: null } });
    });

    it('retirar quita el acceso al instante y deja constancia en el historial', async () => {
      await maria('delete', `/api/comparticiones/${id.compartirAtlasJose}`).expect(204);
      await jose('get', `/api/carpetas/${id.atlas}`).expect(404);
      await jose('get', `/api/archivos/${id.entrega}/contenido`).expect(404);
      await maria('delete', `/api/comparticiones/${id.compartirAtlasJose}`).expect(404);
      const actividad = await coleccion('actividades').findOne({ accion: 'COMPARTICION_RETIRADA' });
      assert.equal(actividad.usuarioAfectado.nombreUsuario, 'jramirez');
      assert.equal(actividad.detalles.permiso, 'edicion');
      assert.equal(actividad.recurso.nombre, 'Atlas');
    });
  });
});
