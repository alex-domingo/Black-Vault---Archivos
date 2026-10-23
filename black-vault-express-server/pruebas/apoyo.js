// Apoyo para las pruebas: usa una base de datos aparte (black_vault_pruebas)
// para no tocar nunca los datos de desarrollo.
const uriBase = process.env.URI_MONGODB ?? 'mongodb://127.0.0.1:27017/black_vault';
process.env.URI_MONGODB = uriBase.replace(/\/([^/?]+)(\?|$)/, '/black_vault_pruebas$2');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRETO ??= 'secreto-solo-para-las-pruebas-automaticas-0123456789';
// Límite de subida pequeño para poder probar el rechazo de archivos grandes.
process.env.TAMANO_MAXIMO_MB = '1';

const { conectar, desconectar, obtenerBd, coleccion } = await import('../src/bd/conexion.js');
const { prepararEsquema } = await import('../src/bd/esquema.js');
const { crearApp } = await import('../src/app.js');
const { generarHash } = await import('../src/servicios/claves.js');

/** Conecta, borra la base de pruebas y la deja con su esquema completo. */
export async function prepararBaseDePruebas() {
  const bd = await conectar();
  await bd.dropDatabase();
  await prepararEsquema(bd);
  return bd;
}

export const CLAVE_PRUEBA = 'Clave2026';
let hashPrueba;

/** Inserta un usuario directamente en la base (sin pasar por la API). */
export async function crearUsuarioDirecto(datos = {}) {
  hashPrueba ??= await generarHash(CLAVE_PRUEBA);
  const ahora = new Date();
  const nombreUsuario = datos.nombreUsuario ?? `usuario${Math.random().toString(36).slice(2, 8)}`;
  const documento = {
    nombreUsuario,
    correo: `${nombreUsuario}@blackvault.gt`,
    claveHash: hashPrueba,
    nombreCompleto: `Usuario ${nombreUsuario}`,
    rol: 'usuario',
    activo: true,
    versionSesion: 0,
    almacenamiento: { usadoBytes: 0, cuotaBytes: 100 * 1024 * 1024 },
    ultimoAcceso: null,
    desactivadoEn: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...datos,
  };
  const { insertedId } = await coleccion('usuarios').insertOne(documento);
  return { ...documento, _id: insertedId };
}

/** Inicia sesión por la API y devuelve el token. */
export async function iniciarSesion(agente, identificador, clave = CLAVE_PRUEBA) {
  const respuesta = await agente.post('/api/autenticacion/iniciar-sesion').send({ identificador, clave });
  if (respuesta.status !== 200) throw new Error(`No se pudo iniciar sesión como ${identificador}: ${respuesta.status} ${JSON.stringify(respuesta.body)}`);
  return respuesta.body.token;
}

export { crearApp, desconectar, obtenerBd, coleccion };
