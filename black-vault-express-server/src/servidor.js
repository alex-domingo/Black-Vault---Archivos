// Punto de entrada: conecta con MongoDB, prepara el esquema y abre el puerto HTTP.
import { entorno, uriSinCredenciales } from './config/entorno.js';
import { conectar, desconectar, haySoporteTransacciones } from './bd/conexion.js';
import { prepararEsquema } from './bd/esquema.js';
import { crearApp } from './app.js';

// Códigos de MongoDB relacionados con credenciales.
const SIN_AUTENTICAR = 13; // Unauthorized: el servidor exige usuario y contraseña
const AUTENTICACION_FALLIDA = 18; // AuthenticationFailed: usuario o contraseña incorrectos

function explicarErrorDeInicio(error) {
  const uri = uriSinCredenciales(entorno.URI_MONGODB);
  if (error?.code === SIN_AUTENTICAR) {
    console.error(`MongoDB en ${uri} tiene la autenticación activada y la URI no trae credenciales`);
    console.error('(o el usuario no tiene permisos sobre esta base de datos).');
    console.error('Agrega usuario y contraseña en URI_MONGODB del archivo .env, por ejemplo:');
    console.error('  URI_MONGODB=mongodb://blackvault:TU_CLAVE@127.0.0.1:27017/black_vault?authSource=admin');
  } else if (error?.code === AUTENTICACION_FALLIDA) {
    console.error(`MongoDB rechazó el usuario o la contraseña de URI_MONGODB (${uri}).`);
    console.error('Revisa las credenciales y authSource. Si la contraseña tiene símbolos (@ : / ? # %), escríbelos codificados (por ejemplo, @ como %40).');
  } else {
    console.error(`No se pudo conectar a MongoDB en ${uri}.`);
    console.error('Verifica que el servicio "MongoDB" esté iniciado en Windows (services.msc).');
  }
  console.error(`Detalle: ${error?.message}`);
}

async function iniciar() {
  let bd;
  let creadas;
  try {
    bd = await conectar();
    ({ creadas } = await prepararEsquema(bd));
  } catch (error) {
    explicarErrorDeInicio(error);
    await desconectar();
    process.exit(1);
  }

  console.log(`MongoDB conectado: base "${bd.databaseName}".`);
  if (creadas.length) console.log(`Colecciones creadas: ${creadas.join(', ')}.`);
  console.log(
    haySoporteTransacciones()
      ? 'Modo atómico: transacciones (replica set detectado).'
      : 'Modo atómico: operaciones ordenadas con compensación (MongoDB standalone).',
  );

  const app = crearApp();
  const servidorHttp = app.listen(entorno.PUERTO, (error) => {
    if (error) {
      console.error(`No se pudo abrir el puerto ${entorno.PUERTO}: ${error.message}`);
      process.exit(1);
    }
    console.log(`Black Vault API escuchando en http://localhost:${entorno.PUERTO}/api`);
  });

  const apagar = async (senal) => {
    console.log(`\nRecibida ${senal}. Cerrando el servidor…`);
    servidorHttp.close(async () => {
      await desconectar();
      process.exit(0);
    });
    // Si alguna conexión no se cierra a tiempo, se fuerza la salida.
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => apagar('SIGINT'));
  process.on('SIGTERM', () => apagar('SIGTERM'));
}

await iniciar();
