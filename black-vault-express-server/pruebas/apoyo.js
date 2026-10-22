// Apoyo para las pruebas: usa una base de datos aparte (black_vault_pruebas)
// para no tocar nunca los datos de desarrollo.
const uriBase = process.env.URI_MONGODB ?? 'mongodb://127.0.0.1:27017/black_vault';
process.env.URI_MONGODB = uriBase.replace(/\/([^/?]+)(\?|$)/, '/black_vault_pruebas$2');
process.env.NODE_ENV = 'test';

const { conectar, desconectar, obtenerBd } = await import('../src/bd/conexion.js');
const { prepararEsquema } = await import('../src/bd/esquema.js');
const { crearApp } = await import('../src/app.js');

/** Conecta, borra la base de pruebas y la deja con su esquema completo. */
export async function prepararBaseDePruebas() {
  const bd = await conectar();
  await bd.dropDatabase();
  await prepararEsquema(bd);
  return bd;
}

export { crearApp, desconectar, obtenerBd };
