// Conexión única a MongoDB, bucket de GridFS y detección de soporte de transacciones.
import { MongoClient, GridFSBucket } from 'mongodb';
import { entorno } from '../config/entorno.js';

export const NOMBRE_BUCKET = 'contenidos';

let cliente = null;
let bd = null;
let bucket = null;
let soportaTransacciones = false;

/**
 * Conecta con MongoDB. Si ya hay una conexión abierta, la reutiliza.
 * @param {string} [uri] URI que incluye el nombre de la base de datos.
 */
export async function conectar(uri = entorno.URI_MONGODB) {
  if (bd) return bd;

  const nuevoCliente = new MongoClient(uri, {
    appName: 'black-vault-server',
    serverSelectionTimeoutMS: 5000,
  });
  await nuevoCliente.connect();

  cliente = nuevoCliente;
  bd = cliente.db(); // la base de datos indicada en la URI
  bucket = new GridFSBucket(bd, { bucketName: NOMBRE_BUCKET });

  // Las transacciones solo existen en replica sets o clústeres fragmentados.
  // Una instalación normal de MongoDB en Windows es standalone.
  const hola = await bd.admin().command({ hello: 1 });
  soportaTransacciones = Boolean(hola.setName) || hola.msg === 'isdbgrid';

  return bd;
}

export function obtenerBd() {
  if (!bd) throw new Error('La base de datos no está conectada. Llama primero a conectar().');
  return bd;
}

/** Atajo para obtener una colección de la base de datos conectada. */
export function coleccion(nombre) {
  return obtenerBd().collection(nombre);
}

export function obtenerCliente() {
  if (!cliente) throw new Error('La base de datos no está conectada.');
  return cliente;
}

/** Bucket de GridFS donde vive el contenido de los archivos (contenidos.files / contenidos.chunks). */
export function obtenerBucket() {
  if (!bucket) throw new Error('La base de datos no está conectada.');
  return bucket;
}

export function haySoporteTransacciones() {
  return soportaTransacciones;
}

/** Estado de la base de datos para el endpoint de salud. Nunca lanza errores. */
export async function estadoBaseDatos() {
  if (!bd) return { conectada: false };
  try {
    const inicio = performance.now();
    await bd.command({ ping: 1 });
    const latenciaMs = Math.round((performance.now() - inicio) * 10) / 10;
    const { version } = await bd.admin().command({ buildInfo: 1 });
    return {
      conectada: true,
      nombre: bd.databaseName,
      version,
      latenciaMs,
      transacciones: soportaTransacciones,
    };
  } catch (error) {
    return { conectada: false, error: error.message };
  }
}

export async function desconectar() {
  if (cliente) await cliente.close();
  cliente = null;
  bd = null;
  bucket = null;
  soportaTransacciones = false;
}
