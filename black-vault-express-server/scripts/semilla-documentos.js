// Carpetas y archivos de la carga inicial: crea la jerarquía, guarda el contenido en
// GridFS y calcula el espacio usado de cada usuario a partir de lo que realmente se guardó.
import { ObjectId } from 'mongodb';
import { calcularSha256, guardarContenido } from '../src/servicios/gridfs.js';
import { normalizarNombre, separarExtension } from '../src/servicios/nombres.js';
import { ARCHIVOS, CARPETAS_VACIAS } from './datos-semilla/estructura.js';
import { plantillas } from './datos-semilla/plantillas.js';

const fechaGt = (texto) => new Date(`${texto}:00-06:00`);
const TIPOS_MIME = { txt: 'text/plain', md: 'text/markdown' };
const BOM_UTF8 = Buffer.from([0xef, 0xbb, 0xbf]);

/** Bytes del documento según su formato: UTF-8 (normal), Windows (BOM + CRLF) o latin1 (heredado). */
function generarBytes(entrada) {
  const texto = plantillas[entrada.plantilla](entrada.datos);
  if (entrada.formato === 'windows') return Buffer.concat([BOM_UTF8, Buffer.from(texto.replace(/\n/g, '\r\n'), 'utf8')]);
  if (entrada.formato === 'latin1') return Buffer.from(texto, 'latin1');
  return Buffer.from(texto, 'utf8');
}

const actor = (u) => ({ _id: u._id, nombreUsuario: u.nombreUsuario, nombreCompleto: u.nombreCompleto, rol: u.rol });
const recurso = (tipo, doc) => ({ tipo, _id: doc._id, nombre: doc.nombre, propietarioId: doc.propietarioId });

/**
 * @returns {Promise<{ carpetas: object[], archivos: object[], actividades: object[] }>}
 */
export async function cargarDocumentos(bd, usuarios) {
  const porNombre = new Map(usuarios.map((u) => [u.nombreUsuario, u]));
  const actividades = [];

  // ---------- Carpetas: todas las rutas mencionadas y sus prefijos ----------
  // Fecha de creación: un poco antes del primer archivo que contengan (o la indicada si están vacías).
  const fechasCarpeta = new Map(); // "usuario|ruta" → Date
  const anotar = (usuario, ruta, fecha) => {
    const partes = ruta.split('/');
    for (let i = 1; i <= partes.length; i++) {
      const clave = `${usuario}|${partes.slice(0, i).join('/')}`;
      const actual = fechasCarpeta.get(clave);
      if (!actual || fecha < actual) fechasCarpeta.set(clave, fecha);
    }
  };
  for (const a of ARCHIVOS) if (a.ruta) anotar(a.usuario, a.ruta, new Date(fechaGt(a.fecha).getTime() - 45 * 60_000));
  for (const c of CARPETAS_VACIAS) anotar(c.usuario, c.ruta, fechaGt(c.fecha));

  const carpetas = new Map(); // clave → documento
  const claves = [...fechasCarpeta.keys()].sort((x, y) => x.split('/').length - y.split('/').length);
  for (const clave of claves) {
    const [nombreUsuario, ruta] = clave.split('|');
    const dueno = porNombre.get(nombreUsuario);
    const partes = ruta.split('/');
    const padre = partes.length > 1 ? carpetas.get(`${nombreUsuario}|${partes.slice(0, -1).join('/')}`) : null;
    // Un padre nunca puede ser más nuevo que su hijo.
    const fecha = fechasCarpeta.get(clave);
    const documento = {
      _id: new ObjectId(),
      nombre: partes.at(-1),
      nombreNormalizado: normalizarNombre(partes.at(-1)),
      propietarioId: dueno._id,
      padreId: padre?._id ?? null,
      ancestros: padre ? [...padre.ancestros, padre._id] : [],
      creadoPor: dueno._id,
      creadoEn: fecha,
      actualizadoEn: fecha,
      enPapelera: false,
      papelera: null,
    };
    carpetas.set(clave, documento);
    actividades.push({
      accion: 'CARPETA_CREADA',
      categoria: 'carpetas',
      fecha,
      actor: actor(dueno),
      recurso: recurso('carpeta', documento),
      detalles: { padre: padre ? { _id: padre._id, nombre: padre.nombre } : null },
      ip: '127.0.0.1',
    });
  }
  if (carpetas.size) await bd.collection('carpetas').insertMany([...carpetas.values()]);

  // ---------- Archivos: contenido en GridFS + metadatos ----------
  const archivos = [];
  const usadoPorUsuario = new Map();
  for (const entrada of ARCHIVOS) {
    const dueno = porNombre.get(entrada.usuario);
    // Quien lo subió: el dueño o un editor de la carpeta compartida (el archivo sigue siendo del dueño).
    const autor = porNombre.get(entrada.creadoPor ?? entrada.usuario);
    const carpeta = entrada.ruta ? carpetas.get(`${entrada.usuario}|${entrada.ruta}`) : null;
    const fecha = fechaGt(entrada.fecha);
    const buffer = generarBytes(entrada);
    const { extension } = separarExtension(entrada.nombre);
    const sha256 = calcularSha256(buffer);
    const archivoId = new ObjectId();
    const gridFsId = await guardarContenido(buffer, {
      nombre: entrada.nombre,
      archivoId,
      propietarioId: dueno._id,
      tipoMime: TIPOS_MIME[extension],
      sha256,
    });

    const documento = {
      _id: archivoId,
      nombre: entrada.nombre,
      nombreNormalizado: normalizarNombre(entrada.nombre),
      extension,
      tipoMime: TIPOS_MIME[extension],
      categoria: entrada.categoria,
      etiquetas: entrada.etiquetas,
      descripcion: entrada.descripcion ?? '',
      propietarioId: dueno._id,
      carpetaId: carpeta?._id ?? null,
      ancestros: carpeta ? [...carpeta.ancestros, carpeta._id] : [],
      contenido: { gridFsId, bytes: buffer.length, sha256, version: 1, actualizadoEn: fecha, actualizadoPor: autor._id },
      comentarios: [],
      creadoPor: autor._id,
      creadoEn: fecha,
      actualizadoEn: fecha,
      enPapelera: false,
      papelera: null,
    };
    archivos.push(documento);
    usadoPorUsuario.set(entrada.usuario, (usadoPorUsuario.get(entrada.usuario) ?? 0) + buffer.length);
    actividades.push({
      accion: 'ARCHIVO_SUBIDO',
      categoria: 'archivos',
      fecha,
      actor: actor(autor),
      recurso: recurso('archivo', documento),
      detalles: { bytes: buffer.length, carpeta: carpeta ? { _id: carpeta._id, nombre: carpeta.nombre } : null },
      ip: '127.0.0.1',
    });
  }
  await bd.collection('archivos').insertMany(archivos);

  // El espacio usado sale de lo que realmente se guardó (consistencia con GridFS).
  for (const [nombreUsuario, bytes] of usadoPorUsuario) {
    await bd.collection('usuarios').updateOne({ _id: porNombre.get(nombreUsuario)._id }, { $set: { 'almacenamiento.usadoBytes': bytes } });
  }

  return { carpetas: [...carpetas.values()], archivos, actividades };
}

/** Un inicio de sesión antes de la primera acción de cada usuario en cada día (hora de Guatemala). */
export function iniciosDeSesion(actividades) {
  const primeraDelDia = new Map();
  for (const a of actividades) {
    const dia = new Date(a.fecha.getTime() - 6 * 3600_000).toISOString().slice(0, 10);
    const clave = `${a.actor._id}|${dia}`;
    const actual = primeraDelDia.get(clave);
    if (!actual || a.fecha < actual.fecha) primeraDelDia.set(clave, a);
  }
  return [...primeraDelDia.values()].map((a) => ({
    accion: 'INICIO_SESION',
    categoria: 'autenticacion',
    fecha: new Date(a.fecha.getTime() - 3 * 60_000),
    actor: a.actor,
    ip: '127.0.0.1',
  }));
}
