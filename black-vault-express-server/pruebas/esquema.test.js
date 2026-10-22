// Comprueba que la base de datos misma hace cumplir las reglas del modelo documental.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { prepararBaseDePruebas, desconectar } from './apoyo.js';
import { prepararEsquema, COLECCIONES } from '../src/bd/esquema.js';

const ahora = new Date();
const ERROR_VALIDACION = 121;
const ERROR_DUPLICADO = 11000;

const usuario = (datos = {}) => ({
  nombreUsuario: 'mlopez',
  correo: 'mlopez@blackvault.gt',
  claveHash: '$2b$10$abcdefghijklmnopqrstuv',
  nombreCompleto: 'María Fernanda López',
  rol: 'usuario',
  activo: true,
  almacenamiento: { usadoBytes: 0, cuotaBytes: 1000 },
  ultimoAcceso: null,
  desactivadoEn: null,
  creadoEn: ahora,
  actualizadoEn: ahora,
  ...datos,
});

const carpeta = (datos) => ({
  nombre: 'Contratos',
  nombreNormalizado: 'contratos',
  padreId: null,
  ancestros: [],
  creadoEn: ahora,
  actualizadoEn: ahora,
  enPapelera: false,
  papelera: null,
  ...datos,
});

async function rechaza(promesa, codigo) {
  await assert.rejects(promesa, (error) => {
    assert.equal(error.code, codigo, error.message);
    return true;
  });
}

describe('Esquema de MongoDB', () => {
  let bd;
  let propietario;

  before(async () => {
    bd = await prepararBaseDePruebas();
    propietario = (await bd.collection('usuarios').insertOne(usuario())).insertedId;
  });

  after(desconectar);

  it('crea las colecciones con su validador e índices', async () => {
    const colecciones = await bd.listCollections().toArray();
    for (const nombre of Object.keys(COLECCIONES)) {
      const info = colecciones.find((c) => c.name === nombre);
      assert.ok(info, `falta la colección ${nombre}`);
      assert.ok(info.options.validator, `${nombre} no tiene validador`);
      assert.equal(info.options.validationLevel, 'strict');
      const indices = (await bd.collection(nombre).indexes()).map((i) => i.name);
      for (const indice of COLECCIONES[nombre].indices) assert.ok(indices.includes(indice.name), `falta ${indice.name}`);
    }
    const indicesChunks = (await bd.collection('contenidos.chunks').indexes()).map((i) => i.name);
    assert.ok(indicesChunks.includes('files_id_1_n_1'));
  });

  it('prepararEsquema es idempotente', async () => {
    const resultado = await prepararEsquema(bd);
    assert.deepEqual(resultado.creadas, []);
  });

  it('rechaza un usuario cuyo espacio usado supera la cuota', async () => {
    await rechaza(
      bd.collection('usuarios').insertOne(usuario({ nombreUsuario: 'otro', correo: 'otro@bv.gt', almacenamiento: { usadoBytes: 2000, cuotaBytes: 1000 } })),
      ERROR_VALIDACION,
    );
  });

  it('rechaza un rol inexistente y nombres de usuario repetidos', async () => {
    await rechaza(bd.collection('usuarios').insertOne(usuario({ nombreUsuario: 'x1', correo: 'x1@bv.gt', rol: 'superusuario' })), ERROR_VALIDACION);
    await rechaza(bd.collection('usuarios').insertOne(usuario({ correo: 'dup@bv.gt' })), ERROR_DUPLICADO);
  });

  it('rechaza jerarquías inválidas de carpetas', async () => {
    const raiz = (await bd.collection('carpetas').insertOne(carpeta({ propietarioId: propietario, creadoPor: propietario }))).insertedId;
    const otra = new ObjectId();
    // el último ancestro no es el padre
    await rechaza(bd.collection('carpetas').insertOne(carpeta({ nombre: 'a', nombreNormalizado: 'a', propietarioId: propietario, creadoPor: propietario, padreId: raiz, ancestros: [otra] })), ERROR_VALIDACION);
    // ancestros en una carpeta raíz
    await rechaza(bd.collection('carpetas').insertOne(carpeta({ nombre: 'b', nombreNormalizado: 'b', propietarioId: propietario, creadoPor: propietario, ancestros: [raiz] })), ERROR_VALIDACION);
    // ciclo: la carpeta es su propio ancestro
    const ciclo = new ObjectId();
    await rechaza(bd.collection('carpetas').insertOne(carpeta({ _id: ciclo, nombre: 'c', nombreNormalizado: 'c', propietarioId: propietario, creadoPor: propietario, padreId: ciclo, ancestros: [ciclo] })), ERROR_VALIDACION);
    // nombre repetido entre carpetas hermanas activas
    await rechaza(bd.collection('carpetas').insertOne(carpeta({ propietarioId: propietario, creadoPor: propietario })), ERROR_DUPLICADO);
  });

  it('permite reutilizar el nombre de una carpeta que está en la papelera', async () => {
    const enPapelera = carpeta({
      nombre: 'Viejos', nombreNormalizado: 'viejos', propietarioId: propietario, creadoPor: propietario, enPapelera: true,
      papelera: { enviadoEn: ahora, enviadoPor: propietario, raizId: new ObjectId(), esRaiz: true },
    });
    await bd.collection('carpetas').insertOne(enPapelera);
    await bd.collection('carpetas').insertOne(carpeta({ nombre: 'Viejos', nombreNormalizado: 'viejos', propietarioId: propietario, creadoPor: propietario }));
  });

  it('impide compartir un recurso con uno mismo y comparticiones repetidas', async () => {
    const base = { tipoRecurso: 'carpeta', recursoId: new ObjectId(), propietarioId: propietario, permiso: 'lectura', creadoEn: ahora, actualizadoEn: ahora };
    await rechaza(bd.collection('comparticiones').insertOne({ ...base, destinatarioId: propietario }), ERROR_VALIDACION);
    const otro = new ObjectId();
    await bd.collection('comparticiones').insertOne({ ...base, destinatarioId: otro });
    await rechaza(bd.collection('comparticiones').insertOne({ ...base, destinatarioId: otro, permiso: 'edicion' }), ERROR_DUPLICADO);
    await rechaza(bd.collection('comparticiones').insertOne({ ...base, destinatarioId: new ObjectId(), permiso: 'admin' }), ERROR_VALIDACION);
  });
});
