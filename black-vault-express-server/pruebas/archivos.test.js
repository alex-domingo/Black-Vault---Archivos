// Carpetas y archivos: GridFS, cuota, nombres, edición, movimiento, permisos y búsqueda.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { prepararBaseDePruebas, crearApp, desconectar, crearUsuarioDirecto, iniciarSesion, coleccion } from './apoyo.js';

const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** Respuesta binaria completa (supertest no la junta por defecto para text/markdown). */
const comoBuffer = (res, callback) => {
  const partes = [];
  res.on('data', (p) => partes.push(p));
  res.on('end', () => callback(null, Buffer.concat(partes)));
};

describe('Carpetas y archivos', () => {
  let api;
  let maria;
  let jose;
  let tokenMaria;
  let tokenJose;
  const comoMaria = (metodo, ruta) => api[metodo](ruta).set('Authorization', `Bearer ${tokenMaria}`);
  const comoJose = (metodo, ruta) => api[metodo](ruta).set('Authorization', `Bearer ${tokenJose}`);
  const subir = (token, buffer, nombre, campos = {}) => {
    let peticion = api.post('/api/archivos').set('Authorization', `Bearer ${token}`).attach('archivo', buffer, { filename: nombre, contentType: 'text/plain' });
    for (const [clave, valor] of Object.entries(campos)) peticion = peticion.field(clave, valor);
    return peticion;
  };
  const usado = async (id) => (await coleccion('usuarios').findOne({ _id: id })).almacenamiento.usadoBytes;
  const ids = {};

  before(async () => {
    await prepararBaseDePruebas();
    api = request(crearApp());
    maria = await crearUsuarioDirecto({ nombreUsuario: 'mlopez', nombreCompleto: 'María Fernanda López' });
    jose = await crearUsuarioDirecto({ nombreUsuario: 'jramirez', nombreCompleto: 'José Antonio Ramírez' });
    tokenMaria = await iniciarSesion(api, 'mlopez');
    tokenJose = await iniciarSesion(api, 'jramirez');
  });

  after(desconectar);

  describe('carpetas', () => {
    it('crea carpetas y subcarpetas con su jerarquía', async () => {
      const contratos = await comoMaria('post', '/api/carpetas').send({ nombre: 'Contratos' }).expect(201);
      const anio = await comoMaria('post', '/api/carpetas').send({ nombre: '2026', padreId: contratos.body._id }).expect(201);
      const informes = await comoMaria('post', '/api/carpetas').send({ nombre: 'Informes' }).expect(201);
      Object.assign(ids, { contratos: contratos.body._id, anio: anio.body._id, informes: informes.body._id });
      const enBd = await coleccion('carpetas').findOne({ nombre: '2026' });
      assert.deepEqual(enBd.ancestros.map(String), [ids.contratos]);
      assert.equal(String(enBd.padreId), ids.contratos);
    });

    it('rechaza nombres repetidos sin importar mayúsculas ni tildes', async () => {
      const r = await comoMaria('post', '/api/carpetas').send({ nombre: '  CONTRATOS ' }).expect(409);
      assert.match(r.body.error.mensaje, /Ya existe una carpeta/);
      await comoMaria('post', '/api/carpetas').send({ nombre: 'Infórmes' }).expect(409);
    });

    it('rechaza nombres inválidos', async () => {
      for (const nombre of ['a/b', 'datos?', 'CON', 'final.', '   ']) {
        await comoMaria('post', '/api/carpetas').send({ nombre }).expect(400);
      }
    });

    it('lista el contenido de la raíz y de una carpeta, con su ruta', async () => {
      const raiz = await comoMaria('get', '/api/carpetas/raiz/contenido').expect(200);
      assert.deepEqual(raiz.body.carpetas.map((c) => c.nombre), ['Contratos', 'Informes']);
      const dentro = await comoMaria('get', `/api/carpetas/${ids.anio}/contenido`).expect(200);
      assert.deepEqual(dentro.body.ruta.map((r) => r.nombre), ['Contratos', '2026']);
      assert.equal(dentro.body.acceso, 'propietario');
    });

    it('renombra y registra el cambio', async () => {
      await comoMaria('patch', `/api/carpetas/${ids.informes}`).send({ nombre: 'Informes mensuales' }).expect(200);
      const actividad = await coleccion('actividades').findOne({ accion: 'CARPETA_RENOMBRADA' });
      assert.equal(actividad.detalles.nombreNuevo, 'Informes mensuales');
    });

    it('otro usuario no ve ni puede usar las carpetas ajenas (404)', async () => {
      await comoJose('get', `/api/carpetas/${ids.contratos}/contenido`).expect(404);
      await comoJose('post', '/api/carpetas').send({ nombre: 'Intruso', padreId: ids.contratos }).expect(404);
      await comoJose('patch', `/api/carpetas/${ids.contratos}`).send({ nombre: 'X' }).expect(404);
    });
  });

  describe('subir, descargar y consultar', () => {
    const acta = Buffer.from('# Acta de reunión\n\nAcuerdos del año 2026: cláusula ñ.\n', 'utf8');

    it('sube un .md con tildes en el nombre y lo guarda en GridFS', async () => {
      const antes = await usado(maria._id);
      const r = await subir(tokenMaria, acta, 'Acta de reunión.md', { carpetaId: ids.anio, categoria: 'informe', etiquetas: 'Reunión, 2026,  reunión ' }).expect(201);
      ids.acta = r.body._id;
      assert.equal(r.body.nombre, 'Acta de reunión.md');
      assert.equal(r.body.extension, 'md');
      assert.equal(r.body.tipoMime, 'text/markdown');
      assert.equal(r.body.bytes, acta.length);
      assert.equal(r.body.sha256, sha(acta));
      assert.deepEqual(r.body.etiquetas, ['reunión', '2026']);
      assert.equal(await usado(maria._id), antes + acta.length);

      const doc = await coleccion('archivos').findOne({ nombre: 'Acta de reunión.md' });
      assert.deepEqual(doc.ancestros.map(String), [ids.contratos, ids.anio]);
      const enGridFs = await coleccion('contenidos.files').findOne({ _id: doc.contenido.gridFsId });
      assert.equal(enGridFs.length, acta.length);
      assert.equal(String(enGridFs.metadata.archivoId), ids.acta);
    });

    it('si el nombre ya existe en la carpeta, lo renombra a "nombre (1)"', async () => {
      const r = await subir(tokenMaria, acta, 'acta de reunion.md', { carpetaId: ids.anio }).expect(201);
      assert.equal(r.body.nombre, 'acta de reunion (1).md');
    });

    it('rechaza tipos no permitidos, binarios y archivos demasiado grandes', async () => {
      await subir(tokenMaria, Buffer.from('%PDF-1.7'), 'reporte.pdf').expect(415);
      await subir(tokenMaria, Buffer.from([0x68, 0x00, 0x6f, 0x00]), 'utf16.txt').expect(415);
      const r = await subir(tokenMaria, Buffer.alloc(1024 * 1024 + 10, 'a'), 'grande.txt').expect(413);
      assert.equal(r.body.error.codigo, 'ARCHIVO_DEMASIADO_GRANDE');
    });

    it('respeta la cuota: si no cabe, no queda nada guardado', async () => {
      const chico = await crearUsuarioDirecto({ nombreUsuario: 'chico', almacenamiento: { usadoBytes: 0, cuotaBytes: 100 } });
      const token = await iniciarSesion(api, 'chico');
      const archivosAntes = await coleccion('contenidos.files').countDocuments();
      const r = await subir(token, Buffer.alloc(200, 'x'), 'grande.txt').expect(409);
      assert.equal(r.body.error.codigo, 'CUOTA_EXCEDIDA');
      assert.equal(await usado(chico._id), 0);
      assert.equal(await coleccion('contenidos.files').countDocuments(), archivosAntes);
      await subir(token, Buffer.alloc(100, 'x'), 'justo.txt').expect(201);
      assert.equal(await usado(chico._id), 100);
    });

    it('descarga byte a byte con el nombre correcto', async () => {
      const r = await comoMaria('get', `/api/archivos/${ids.acta}/descarga`).buffer(true).parse(comoBuffer).expect(200);
      assert.ok(Buffer.compare(r.body, acta) === 0, 'los bytes no coinciden');
      assert.equal(r.headers['x-contenido-sha256'], sha(acta));
      assert.match(r.headers['content-disposition'], /filename\*=UTF-8''Acta%20de%20reuni%C3%B3n\.md/);
      assert.equal(await coleccion('actividades').countDocuments({ accion: 'ARCHIVO_DESCARGADO' }), 1);
    });

    it('la vista previa devuelve el texto y queda registrada como consulta', async () => {
      const r = await comoMaria('get', `/api/archivos/${ids.acta}/contenido`).expect(200);
      assert.equal(r.body.contenido, acta.toString('utf8'));
      assert.equal(r.body.esUtf8, true);
      assert.equal(r.body.version, 1);
      assert.equal(await coleccion('actividades').countDocuments({ accion: 'ARCHIVO_CONSULTADO' }), 1);
    });

    it('el detalle informa propiedad, ubicación y acceso', async () => {
      const r = await comoMaria('get', `/api/archivos/${ids.acta}`).expect(200);
      assert.equal(r.body.propietario.nombreUsuario, 'mlopez');
      assert.deepEqual(r.body.ruta.map((c) => c.nombre), ['Contratos', '2026']);
      assert.equal(r.body.acceso, 'propietario');
      assert.equal(r.body.gridFsId, undefined);
    });
  });

  describe('editar contenido', () => {
    it('conserva BOM y saltos CRLF, sube la versión y ajusta el espacio', async () => {
      const original = Buffer.concat([BOM, Buffer.from('Línea 1\r\nLínea 2\r\n', 'utf8')]);
      const subida = await subir(tokenMaria, original, 'notas windows.txt').expect(201);
      const id = subida.body._id;
      const antes = await usado(maria._id);
      const docAntes = await coleccion('archivos').findOne({ nombre: 'notas windows.txt' });

      const r = await comoMaria('put', `/api/archivos/${id}/contenido`).send({ contenido: 'Línea 1\nLínea 2\nLínea 3 nueva\n', versionEsperada: 1 }).expect(200);
      assert.equal(r.body.version, 2);

      const descarga = await comoMaria('get', `/api/archivos/${id}/descarga`).buffer(true).parse(comoBuffer).expect(200);
      const esperado = Buffer.concat([BOM, Buffer.from('Línea 1\r\nLínea 2\r\nLínea 3 nueva\r\n', 'utf8')]);
      assert.ok(Buffer.compare(descarga.body, esperado) === 0, 'se perdió el BOM o los CRLF');
      assert.equal(await usado(maria._id), antes + (esperado.length - original.length));
      assert.equal(await coleccion('contenidos.files').countDocuments({ _id: docAntes.contenido.gridFsId }), 0, 'el contenido anterior debe borrarse');
    });

    it('rechaza una edición sobre una versión vieja (409)', async () => {
      const doc = await coleccion('archivos').findOne({ nombre: 'notas windows.txt' });
      const r = await comoMaria('put', `/api/archivos/${doc._id}/contenido`).send({ contenido: 'otra cosa', versionEsperada: 1 }).expect(409);
      assert.equal(r.body.error.detalles.versionActual, 2);
    });

    it('un archivo que no es UTF-8 se puede ver pero no editar', async () => {
      const latin1 = Buffer.from('Año de cláusulas', 'latin1');
      const subida = await subir(tokenMaria, latin1, 'viejo.txt').expect(201);
      const vista = await comoMaria('get', `/api/archivos/${subida.body._id}/contenido`).expect(200);
      assert.equal(vista.body.esUtf8, false);
      await comoMaria('put', `/api/archivos/${subida.body._id}/contenido`).send({ contenido: 'x', versionEsperada: 1 }).expect(422);
    });
  });

  describe('renombrar, clasificar y mover', () => {
    it('renombrar conserva la extensión', async () => {
      const r = await comoMaria('patch', `/api/archivos/${ids.acta}`).send({ nombre: 'Acta final' }).expect(200);
      assert.equal(r.body.nombre, 'Acta final.md');
      await comoMaria('patch', `/api/archivos/${ids.acta}`).send({ nombre: 'Acta final.txt' }).expect(400);
      await comoMaria('patch', `/api/archivos/${ids.acta}`).send({ nombre: 'acta de reunion (1)' }).expect(409);
    });

    it('actualiza categoría, etiquetas y descripción', async () => {
      const r = await comoMaria('patch', `/api/archivos/${ids.acta}`).send({ categoria: 'contrato', etiquetas: ['Cliente', 'vigente'], descripcion: 'Acta firmada' }).expect(200);
      assert.equal(r.body.categoria, 'contrato');
      assert.deepEqual(r.body.etiquetas, ['cliente', 'vigente']);
      assert.equal(await coleccion('actividades').countDocuments({ accion: 'ARCHIVO_ACTUALIZADO' }), 1);
    });

    it('mueve un archivo a la raíz y de regreso', async () => {
      await comoMaria('patch', `/api/archivos/${ids.acta}/mover`).send({ destinoId: null }).expect(200);
      let doc = await coleccion('archivos').findOne({ nombre: 'Acta final.md' });
      assert.equal(doc.carpetaId, null);
      assert.deepEqual(doc.ancestros, []);
      await comoMaria('patch', `/api/archivos/${ids.acta}/mover`).send({ destinoId: ids.anio }).expect(200);
      doc = await coleccion('archivos').findOne({ nombre: 'Acta final.md' });
      assert.deepEqual(doc.ancestros.map(String), [ids.contratos, ids.anio]);
    });

    it('mueve una carpeta con todo su contenido y evita ciclos', async () => {
      await comoMaria('patch', `/api/carpetas/${ids.contratos}/mover`).send({ destinoId: ids.anio }).expect(409);
      await comoMaria('patch', `/api/carpetas/${ids.contratos}/mover`).send({ destinoId: ids.contratos }).expect(409);
      await comoMaria('patch', `/api/carpetas/${ids.anio}/mover`).send({ destinoId: ids.informes }).expect(200);

      const anio = await coleccion('carpetas').findOne({ nombre: '2026' });
      assert.deepEqual(anio.ancestros.map(String), [ids.informes]);
      const acta = await coleccion('archivos').findOne({ nombre: 'Acta final.md' });
      assert.deepEqual(acta.ancestros.map(String), [ids.informes, ids.anio]);
      const actividad = await coleccion('actividades').findOne({ accion: 'CARPETA_MOVIDA' });
      assert.equal(actividad.detalles.elementosAfectados.archivos, 2);
    });

    it('no se puede mover a una carpeta de otro usuario', async () => {
      const ajena = await comoJose('post', '/api/carpetas').send({ nombre: 'De José' }).expect(201);
      await comoMaria('patch', `/api/archivos/${ids.acta}/mover`).send({ destinoId: ajena.body._id }).expect(404);
      ids.deJose = ajena.body._id;
    });
  });

  describe('acceso compartido (heredado de carpeta)', () => {
    const compartir = (recursoId, permiso) =>
      coleccion('comparticiones').updateOne(
        { recursoId: new ObjectId(recursoId), destinatarioId: jose._id },
        { $set: { tipoRecurso: 'carpeta', propietarioId: maria._id, permiso, creadoEn: new Date(), actualizadoEn: new Date() } },
        { upsert: true },
      );

    it('con lectura sobre "Informes mensuales" ve, consulta y descarga, pero no modifica', async () => {
      await compartir(ids.informes, 'lectura');
      const contenido = await comoJose('get', `/api/carpetas/${ids.anio}/contenido`).expect(200);
      assert.equal(contenido.body.acceso, 'lectura');
      assert.deepEqual(contenido.body.ruta.map((r) => r.nombre), ['Informes mensuales', '2026']);
      await comoJose('get', `/api/archivos/${ids.acta}/contenido`).expect(200);
      await comoJose('get', `/api/archivos/${ids.acta}/descarga`).expect(200);
      const r = await comoJose('patch', `/api/archivos/${ids.acta}`).send({ nombre: 'hackeado' }).expect(403);
      assert.match(r.body.error.mensaje, /lectura/);
      await subir(tokenJose, Buffer.from('hola'), 'nuevo.txt', { carpetaId: ids.anio }).expect(403);
      await comoJose('get', `/api/carpetas/${ids.contratos}/contenido`).expect(404);
    });

    it('con edición sube archivos que pertenecen a la dueña y usan su cuota; mover sigue siendo solo de la dueña', async () => {
      await compartir(ids.informes, 'edicion');
      const antesMaria = await usado(maria._id);
      const antesJose = await usado(jose._id);
      const r = await subir(tokenJose, Buffer.from('aporte de José'), 'aporte.txt', { carpetaId: ids.anio }).expect(201);
      assert.equal(String(r.body.propietarioId), String(maria._id));
      assert.equal(String(r.body.creadoPor), String(jose._id));
      assert.equal(await usado(maria._id), antesMaria + Buffer.byteLength('aporte de José'));
      assert.equal(await usado(jose._id), antesJose);
      await comoJose('put', `/api/archivos/${r.body._id}/contenido`).send({ contenido: 'aporte corregido', versionEsperada: 1 }).expect(200);
      await comoJose('patch', `/api/archivos/${ids.acta}/mover`).send({ destinoId: null }).expect(403);
    });
  });

  describe('búsqueda y espacio', () => {
    it('busca sin importar tildes ni mayúsculas, y filtra por tipo, categoría y etiqueta', async () => {
      const r = await comoMaria('get', '/api/archivos?buscar=ACTA&alcance=propios').expect(200);
      assert.deepEqual(r.body.datos.map((a) => a.nombre).sort(), ['Acta final.md', 'acta de reunion (1).md']);
      const tilde = await comoMaria('get', '/api/archivos?buscar=reunión').expect(200);
      assert.equal(tilde.body.total, 1);
      const md = await comoMaria('get', '/api/archivos?tipo=md&alcance=propios').expect(200);
      assert.ok(md.body.datos.every((a) => a.extension === 'md'));
      const contrato = await comoMaria('get', '/api/archivos?categoria=contrato').expect(200);
      assert.equal(contrato.body.total, 1);
      const etiqueta = await comoMaria('get', '/api/archivos?etiqueta=vigente').expect(200);
      assert.equal(etiqueta.body.datos[0].nombre, 'Acta final.md');
      assert.equal(etiqueta.body.datos[0].carpeta.nombre, '2026');
    });

    it('la búsqueda por palabras usa el índice de texto en español', async () => {
      const r = await comoMaria('get', '/api/archivos?texto=firmadas&orden=relevancia').expect(200);
      assert.equal(r.body.datos[0]?.nombre, 'Acta final.md');
    });

    it('José encuentra lo compartido con él, separado de lo suyo', async () => {
      const compartidos = await comoJose('get', '/api/archivos?alcance=compartidos').expect(200);
      assert.ok(compartidos.body.total >= 2);
      assert.ok(compartidos.body.datos.every((a) => a.esPropio === false));
      const propios = await comoJose('get', '/api/archivos?alcance=propios').expect(200);
      assert.equal(propios.body.total, 0);
    });

    it('filtra por rango de fechas (hora de Guatemala)', async () => {
      const hoy = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
      const r = await comoMaria('get', `/api/archivos?desde=${hoy}&hasta=${hoy}&alcance=propios`).expect(200);
      assert.ok(r.body.total > 0);
      const futuro = await comoMaria('get', '/api/archivos?desde=2030-01-01&alcance=propios').expect(200);
      assert.equal(futuro.body.total, 0);
      await comoMaria('get', '/api/archivos?desde=2026-12-01&hasta=2026-01-01').expect(400);
    });

    it('el espacio usado coincide con la suma de los archivos (consistencia)', async () => {
      const r = await comoMaria('get', '/api/almacenamiento').expect(200);
      const [suma] = await coleccion('archivos')
        .aggregate([{ $match: { propietarioId: maria._id } }, { $group: { _id: null, bytes: { $sum: '$contenido.bytes' } } }])
        .toArray();
      assert.equal(r.body.usadoBytes, suma.bytes);
      assert.equal(r.body.porTipo.reduce((s, t) => s + t.bytes, 0), suma.bytes);
      const huerfanos = await coleccion('contenidos.files')
        .aggregate([
          { $lookup: { from: 'archivos', localField: '_id', foreignField: 'contenido.gridFsId', as: 'a' } },
          { $match: { a: { $size: 0 } } },
        ])
        .toArray();
      assert.equal(huerfanos.length, 0, 'no debe quedar contenido huérfano en GridFS');
    });
  });
});
