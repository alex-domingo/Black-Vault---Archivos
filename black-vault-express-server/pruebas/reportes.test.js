// Reportes del administrador: cada cifra se compara con datos armados a propósito.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { prepararBaseDePruebas, crearApp, desconectar, crearUsuarioDirecto, iniciarSesion, coleccion } from './apoyo.js';

describe('Reportes', () => {
  let api;
  const u = {};
  const t = {};
  const id = {};
  const como = (quien) => (ruta) => api.get(ruta).set('Authorization', `Bearer ${t[quien]}`);
  const enviar = (quien, metodo, ruta) => api[metodo](ruta).set('Authorization', `Bearer ${t[quien]}`);
  const admin = como('admin');

  const subir = (quien, nombre, texto, campos = {}) => {
    let p = api
      .post('/api/archivos')
      .set('Authorization', `Bearer ${t[quien]}`)
      .attach('archivo', Buffer.from(texto), { filename: nombre, contentType: 'text/plain' });
    for (const [k, v] of Object.entries(campos)) p = p.field(k, v);
    return p.expect(201).then((r) => r.body._id);
  };
  const compartir = (quien, tipoRecurso, recursoId, para, permiso = 'lectura') =>
    enviar(quien, 'post', '/api/comparticiones').send({ tipoRecurso, recursoId, destinatarioId: String(u[para]._id), permiso }).expect(201);
  /** Historial con fecha fija (hora de Guatemala) para probar rangos y períodos. */
  const actividadEn = (quien, fechaGt, accion = 'INICIO_SESION', categoria = 'autenticacion') => ({
    accion,
    categoria,
    fecha: new Date(`${fechaGt}-06:00`),
    actor: { _id: u[quien]._id, nombreUsuario: u[quien].nombreUsuario, nombreCompleto: u[quien].nombreCompleto, rol: u[quien].rol },
  });

  before(async () => {
    await prepararBaseDePruebas();
    api = request(crearApp());
    u.admin = await crearUsuarioDirecto({ nombreUsuario: 'admin', nombreCompleto: 'Administrador', rol: 'administrador' });
    u.maria = await crearUsuarioDirecto({ nombreUsuario: 'mlopez', nombreCompleto: 'María Fernanda López' });
    u.jose = await crearUsuarioDirecto({ nombreUsuario: 'jramirez', nombreCompleto: 'José Antonio Ramírez' });
    u.ana = await crearUsuarioDirecto({ nombreUsuario: 'agarcia', nombreCompleto: 'Ana Lucía García' });
    for (const quien of Object.keys(u)) t[quien] = await iniciarSesion(api, u[quien].nombreUsuario);

    // María: 3 archivos (2 md, 1 txt) en una carpeta compartida con José y Ana; uno además directo con Ana.
    id.carpeta = (await enviar('maria', 'post', '/api/carpetas').send({ nombre: 'Legal' }).expect(201)).body._id;
    id.contrato = await subir('maria', 'Contrato.md', '# Contrato\n', { carpetaId: id.carpeta, categoria: 'contrato' });
    id.acta = await subir('maria', 'Acta.md', '# Acta\n', { carpetaId: id.carpeta, categoria: 'informe' });
    id.nota = await subir('maria', 'Nota.txt', 'nota\n', { categoria: 'otro' });
    await compartir('maria', 'carpeta', id.carpeta, 'jose', 'edicion');
    await compartir('maria', 'carpeta', id.carpeta, 'ana', 'lectura');
    await compartir('maria', 'archivo', id.contrato, 'ana', 'comentario');
    // José: 1 archivo compartido con María; otro que envía a la papelera.
    id.presupuesto = await subir('jose', 'Presupuesto.txt', 'Q 100\n', { categoria: 'administrativo' });
    id.borrador = await subir('jose', 'Borrador.txt', 'tmp\n');
    await compartir('jose', 'archivo', id.presupuesto, 'maria');
    await enviar('jose', 'delete', `/api/archivos/${id.borrador}`).expect(200);
    // Lecturas del contrato para que sea el archivo con más operaciones.
    for (const quien of ['maria', 'jose', 'ana', 'ana']) await enviar(quien, 'get', `/api/archivos/${id.contrato}/contenido`).expect(200);
  });

  after(desconectar);

  it('solo el administrador puede consultar los reportes', async () => {
    await como('maria')('/api/reportes/resumen').expect(403);
    await api.get('/api/reportes/resumen').expect(401);
    await admin('/api/reportes/resumen').expect(200);
  });

  it('resumen: usuarios, archivos, papelera, comparticiones y actividad', async () => {
    const r = (await admin('/api/reportes/resumen').expect(200)).body;
    assert.deepEqual([r.usuarios.total, r.usuarios.activos, r.usuarios.administradores], [4, 4, 1]);
    assert.deepEqual([r.archivos.activos, r.archivos.enPapelera], [4, 1]);
    assert.equal(r.carpetas.activas, 1);
    assert.deepEqual([r.comparticiones.total, r.comparticiones.archivos, r.comparticiones.carpetas], [4, 2, 2]);
    assert.equal(r.actividad.ultimos30Dias.length, 30);
    assert.equal(r.actividad.ultimos30Total, r.actividad.total); // todo ocurrió hoy
  });

  it('RR-01 archivos por tipo, sin y con la papelera, y por categoría', async () => {
    const sin = (await admin('/api/reportes/archivos-por-tipo').expect(200)).body;
    assert.deepEqual(sin.porTipo.map((x) => [x.tipo, x.cantidad]), [['md', 2], ['txt', 2]]);
    assert.equal(sin.total.cantidad, 4);
    const con = (await admin('/api/reportes/archivos-por-tipo?incluirPapelera=true').expect(200)).body;
    assert.deepEqual(con.porTipo.map((x) => [x.tipo, x.cantidad, x.enPapelera]), [['txt', 3, 1], ['md', 2, 0]]);
    assert.equal(con.porCategoria.find((c) => c.categoria === 'contrato').cantidad, 1);
    await admin('/api/reportes/archivos-por-tipo?incluirPapelera=quizas').expect(400);
  });

  it('RR-02 archivos por rango de fechas, con la serie diaria completa', async () => {
    const antiguo = await coleccion('archivos').findOne({ _id: new ObjectId(id.acta) });
    await coleccion('archivos').updateOne({ _id: antiguo._id }, { $set: { creadoEn: new Date('2026-03-10T12:00:00-06:00') } });
    const r = (await admin('/api/reportes/archivos-por-fecha?desde=2026-03-01&hasta=2026-03-31').expect(200)).body;
    assert.deepEqual(r.datos.map((a) => [a.nombre, a.propietario.nombreUsuario, a.carpeta]), [['Acta.md', 'mlopez', 'Legal']]);
    assert.equal(r.total, 1);
    assert.equal(r.unidadSerie, 'dia');
    assert.equal(r.serie.length, 31); // un punto por día, con ceros
    assert.equal(r.serie.find((d) => d.cantidad === 1).periodo, '2026-03-10T06:00:00.000Z');
    // Un rango largo se agrupa por semana (lunes) para que la gráfica no tenga cientos de columnas.
    const largo = (await admin('/api/reportes/archivos-por-fecha?desde=2026-01-01&hasta=2026-06-30').expect(200)).body;
    assert.equal(largo.unidadSerie, 'semana');
    assert.equal(largo.serie[0].periodo, '2025-12-29T06:00:00.000Z'); // lunes de la semana del 1 de enero
    assert.equal(largo.serie.find((p) => p.cantidad === 1).periodo, '2026-03-09T06:00:00.000Z');
    assert.equal((await admin('/api/reportes/archivos-por-fecha').expect(200)).body.unidadSerie, 'mes');
    await admin('/api/reportes/archivos-por-fecha?desde=2026-04-01&hasta=2026-03-01').expect(400);
  });

  it('RR-03 archivos con más operaciones, incluso los que ya no existen', async () => {
    // Un archivo eliminado definitivamente solo vive en el historial.
    const fantasma = new ObjectId();
    await coleccion('actividades').insertMany(
      Array.from({ length: 2 }, () => ({
        ...actividadEn('jose', '2026-02-01T10:00:00', 'ARCHIVO_CONSULTADO', 'archivos'),
        recurso: { tipo: 'archivo', _id: fantasma, nombre: 'Viejo.txt', propietarioId: u.jose._id },
      })),
    );
    const r = (await admin('/api/reportes/archivos-mas-operaciones?limite=10').expect(200)).body;
    assert.equal(r[0].nombre, 'Contrato.md');
    assert.equal(r[0].estado, 'activo');
    assert.equal(r[0].porAccion.find((a) => a.accion === 'ARCHIVO_CONSULTADO').cantidad, 4);
    const viejo = r.find((a) => a.nombre === 'Viejo.txt');
    assert.deepEqual([viejo.estado, viejo.operaciones], ['eliminado', 2]);
    assert.equal(r.find((a) => a.nombre === 'Borrador.txt').estado, 'papelera');
    const deFebrero = (await admin('/api/reportes/archivos-mas-operaciones?desde=2026-02-01&hasta=2026-02-28').expect(200)).body;
    assert.deepEqual(deFebrero.map((a) => a.nombre), ['Viejo.txt']);
  });

  it('RR-04 usuarios con más archivos: ordena por activos y muestra la papelera aparte', async () => {
    const r = (await admin('/api/reportes/usuarios-mas-archivos').expect(200)).body;
    assert.deepEqual(r.map((x) => [x.usuario.nombreUsuario, x.activos, x.enPapelera]), [['mlopez', 3, 0], ['jramirez', 1, 1]]);
    assert.equal((await admin('/api/reportes/usuarios-mas-archivos?limite=1').expect(200)).body.length, 1);
    await admin('/api/reportes/usuarios-mas-archivos?limite=0').expect(400);
  });

  it('RR-05 usuarios que más comparten: recursos, comparticiones y destinatarios distintos', async () => {
    const r = (await admin('/api/reportes/usuarios-mas-compartidos').expect(200)).body;
    const maria = r[0];
    assert.equal(maria.usuario.nombreUsuario, 'mlopez');
    assert.deepEqual([maria.recursos, maria.comparticiones, maria.destinatarios], [2, 3, 2]);
    assert.deepEqual([maria.lectura, maria.comentario, maria.edicion], [1, 1, 1]);
  });

  it('RR-06 archivos compartidos con más usuarios: directos y efectivos (con herencia)', async () => {
    const r = (await admin('/api/reportes/archivos-mas-compartidos').expect(200)).body;
    const contrato = r.find((a) => a.nombre === 'Contrato.md');
    // Directo: Ana. Efectivo: Ana y José (por la carpeta "Legal").
    assert.deepEqual([contrato.usuariosDirectos, contrato.usuariosEfectivos, contrato.heredados], [1, 2, 1]);
    const acta = r.find((a) => a.nombre === 'Acta.md');
    assert.deepEqual([acta.usuariosDirectos, acta.usuariosEfectivos], [0, 2]); // solo por la carpeta
    assert.equal(r[0].nombre, 'Contrato.md'); // empata en efectivos y gana por directos
    assert.ok(!r.some((a) => a.nombre === 'Nota.txt')); // no está compartido de ninguna forma
  });

  it('RR-07 y RR-08: compartido por y recibido por un usuario', async () => {
    const hechas = (await admin(`/api/reportes/compartidos-por-usuario/${u.maria._id}`).expect(200)).body;
    assert.equal(hechas.total, 3);
    assert.equal(hechas.personas, 2);
    assert.ok(hechas.datos.every((c) => c.destinatario && c.estado === 'activo'));
    const recibidas = (await admin(`/api/reportes/recibidos-por-usuario/${u.maria._id}`).expect(200)).body;
    assert.deepEqual(recibidas.datos.map((c) => [c.recurso.nombre, c.propietario.nombreUsuario]), [['Presupuesto.txt', 'jramirez']]);
    const soloCarpetas = (await admin(`/api/reportes/compartidos-por-usuario/${u.maria._id}?tipo=carpeta`).expect(200)).body;
    assert.equal(soloCarpetas.total, 2);
    await admin(`/api/reportes/recibidos-por-usuario/${new ObjectId()}`).expect(404);
  });

  it('RR-09 actividad de un usuario en un rango, con desglose por categoría', async () => {
    await coleccion('actividades').insertMany([
      actividadEn('ana', '2026-01-05T09:00:00'),
      actividadEn('ana', '2026-01-20T09:00:00', 'ARCHIVO_DESCARGADO', 'archivos'),
      actividadEn('ana', '2026-02-02T09:00:00'),
    ]);
    const r = (await admin(`/api/reportes/actividad-usuario/${u.ana._id}?desde=2026-01-01&hasta=2026-01-31`).expect(200)).body;
    assert.equal(r.total, 2);
    assert.deepEqual(r.datos.map((a) => a.accion), ['ARCHIVO_DESCARGADO', 'INICIO_SESION']); // más reciente primero
    const soloArchivos = (await admin(`/api/reportes/actividad-usuario/${u.ana._id}?desde=2026-01-01&hasta=2026-01-31&categoria=archivos`).expect(200)).body;
    assert.equal(soloArchivos.total, 1);
    assert.equal(soloArchivos.porCategoria.length, 2); // el desglose no se filtra por categoría
  });

  it('RR-10 operaciones agrupadas por tipo dentro de su categoría', async () => {
    const r = (await admin('/api/reportes/operaciones-por-tipo?desde=2026-01-01&hasta=2026-01-31').expect(200)).body;
    assert.equal(r.total, 2);
    assert.deepEqual(
      r.categorias.map((c) => [c.categoria, c.total, c.acciones.map((a) => a.accion)]).sort(),
      [['archivos', 1, ['ARCHIVO_DESCARGADO']], ['autenticacion', 1, ['INICIO_SESION']]],
    );
  });

  it('RR-11 operaciones por período: límites alineados y períodos vacíos en cero', async () => {
    const porMes = (await admin('/api/reportes/operaciones-por-periodo?unidad=mes&desde=2026-01-15&hasta=2026-03-02').expect(200)).body;
    assert.deepEqual([porMes.desde, porMes.hasta], ['2026-01-01', '2026-03-31']);
    assert.deepEqual(porMes.serie.map((p) => [p.periodo, p.cantidad]), [
      ['2026-01-01T06:00:00.000Z', 2],
      ['2026-02-01T06:00:00.000Z', 3], // inicio de sesión de Ana + 2 consultas de Viejo.txt
      ['2026-03-01T06:00:00.000Z', 0],
    ]);
    const porSemana = (await admin('/api/reportes/operaciones-por-periodo?unidad=semana&desde=2026-01-07&hasta=2026-01-20').expect(200)).body;
    assert.equal(porSemana.desde, '2026-01-05'); // lunes
    assert.deepEqual(porSemana.serie.map((p) => p.cantidad), [1, 0, 1]); // 5 y 20 de enero
    const porDia = (await admin('/api/reportes/operaciones-por-periodo?unidad=dia&desde=2026-01-04&hasta=2026-01-06').expect(200)).body;
    assert.deepEqual(porDia.serie.map((p) => p.cantidad), [0, 1, 0]);
    // Una actividad a las 23:30 del 31 de enero en Guatemala cuenta en enero, no en febrero (UTC).
    await coleccion('actividades').insertOne(actividadEn('jose', '2026-01-31T23:30:00'));
    const limite = (await admin('/api/reportes/operaciones-por-periodo?unidad=mes&desde=2026-01-01&hasta=2026-02-28').expect(200)).body;
    assert.deepEqual(limite.serie.map((p) => p.cantidad), [3, 3]);
    const conCategoria = (await admin('/api/reportes/operaciones-por-periodo?unidad=mes&desde=2026-01-01&hasta=2026-01-31&categoria=archivos').expect(200)).body;
    assert.equal(conCategoria.total, 1);
    await admin('/api/reportes/operaciones-por-periodo?unidad=dia&desde=2020-01-01&hasta=2026-01-01').expect(400);
    await admin('/api/reportes/operaciones-por-periodo?unidad=hora').expect(400);
  });

  it('RR-12 principales acciones: porcentaje del total, usuarios distintos y quién más la realiza', async () => {
    const r = (await admin('/api/reportes/principales-acciones?desde=2026-01-01&hasta=2026-02-28&limite=10').expect(200)).body;
    const total = r.reduce((s, a) => s + a.cantidad, 0);
    assert.equal(total, 6);
    const inicio = r.find((a) => a.accion === 'INICIO_SESION');
    assert.deepEqual([inicio.cantidad, inicio.usuariosDistintos, inicio.usuarioPrincipal.nombreUsuario], [3, 2, 'agarcia']);
    assert.equal(inicio.porcentaje, 50);
    assert.ok(r.every((a, i) => i === 0 || r[i - 1].cantidad >= a.cantidad));
    assert.equal((await admin('/api/reportes/principales-acciones?desde=2026-01-01&hasta=2026-02-28&limite=1').expect(200)).body.length, 1);
  });
});
