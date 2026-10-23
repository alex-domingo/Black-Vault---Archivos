// Carga inicial de la base de datos (npm run semilla).
//
// BORRA la base indicada en URI_MONGODB y la vuelve a crear con su esquema
// (validadores e índices) y los datos de demostración.
// Uso:  npm run semilla              (pide confirmación)
//       npm run semilla -- --forzar  (sin confirmación)
//
// Contenido actual: usuarios, carpetas, archivos en GridFS y su historial.
// Las fases siguientes agregan comparticiones, papelera y el resto del historial.
import { createInterface } from 'node:readline/promises';
import { entorno, uriSinCredenciales } from '../src/config/entorno.js';
import { conectar, desconectar } from '../src/bd/conexion.js';
import { prepararEsquema } from '../src/bd/esquema.js';
import { generarHash } from '../src/servicios/claves.js';
import { CLAVE_ADMINISTRADOR, CLAVE_USUARIOS, USUARIOS_SEMILLA } from './datos-semilla/usuarios.js';
import { cargarDocumentos } from './semilla-documentos.js';

const MB = 1024 * 1024;

/** Fecha en hora de Guatemala (UTC−6, sin horario de verano). */
const fechaGt = (texto) => new Date(`${texto}:00-06:00`);

async function confirmar(nombreBd) {
  if (process.argv.includes('--forzar')) return true;
  const consola = createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await consola.question(
    `Se BORRARÁ la base "${nombreBd}" en ${uriSinCredenciales(entorno.URI_MONGODB)} y se cargarán los datos de demostración.\nEscribe SI para continuar: `,
  );
  consola.close();
  return respuesta.trim().toUpperCase() === 'SI';
}

async function cargarUsuarios(bd) {
  const hashes = {
    administrador: await generarHash(CLAVE_ADMINISTRADOR),
    usuario: await generarHash(CLAVE_USUARIOS),
  };

  const documentos = USUARIOS_SEMILLA.map((u) => {
    const creadoEn = fechaGt(u.creadoEn);
    const desactivadoEn = u.desactivadoEn ? fechaGt(u.desactivadoEn) : null;
    const rol = u.rol ?? 'usuario';
    return {
      nombreUsuario: u.nombreUsuario,
      correo: `${u.nombreUsuario}@blackvault.gt`,
      claveHash: hashes[rol],
      nombreCompleto: u.nombreCompleto,
      rol,
      activo: !desactivadoEn,
      versionSesion: desactivadoEn ? 1 : 0,
      almacenamiento: { usadoBytes: 0, cuotaBytes: (u.cuotaMb ?? entorno.CUOTA_POR_DEFECTO_MB) * MB },
      ultimoAcceso: null,
      desactivadoEn,
      creadoEn,
      actualizadoEn: desactivadoEn ?? creadoEn,
    };
  });

  const { insertedIds } = await bd.collection('usuarios').insertMany(documentos);
  documentos.forEach((d, i) => (d._id = insertedIds[i]));
  return documentos;
}

function historialDeUsuarios(usuarios) {
  const admin = usuarios.find((u) => u.rol === 'administrador');
  const actor = { _id: admin._id, nombreUsuario: admin.nombreUsuario, nombreCompleto: admin.nombreCompleto, rol: admin.rol };
  const afectado = (u) => ({ _id: u._id, nombreUsuario: u.nombreUsuario, nombreCompleto: u.nombreCompleto });
  const ip = '127.0.0.1';

  const actividades = [
    { accion: 'INICIO_SESION', categoria: 'autenticacion', fecha: new Date(admin.creadoEn.getTime() + 5 * 60_000), actor, ip },
  ];
  for (const u of usuarios.filter((x) => x !== admin)) {
    actividades.push({
      accion: 'USUARIO_CREADO',
      categoria: 'usuarios',
      fecha: u.creadoEn,
      actor,
      usuarioAfectado: afectado(u),
      detalles: { rol: u.rol, cuotaBytes: u.almacenamiento.cuotaBytes },
      ip,
    });
    if (u.desactivadoEn) {
      actividades.push({ accion: 'USUARIO_DESACTIVADO', categoria: 'usuarios', fecha: u.desactivadoEn, actor, usuarioAfectado: afectado(u), ip });
    }
  }
  return actividades.sort((a, b) => a.fecha - b.fecha);
}

async function ejecutar() {
  const bd = await conectar();
  if (!(await confirmar(bd.databaseName))) {
    console.log('Carga inicial cancelada. No se modificó nada.');
    return;
  }

  console.log(`Reconstruyendo la base "${bd.databaseName}"…`);
  await bd.dropDatabase();
  await prepararEsquema(bd);

  const usuarios = await cargarUsuarios(bd);
  const documentos = await cargarDocumentos(bd, usuarios);
  const actividades = [...historialDeUsuarios(usuarios), ...documentos.actividades].sort((a, b) => a.fecha - b.fecha);
  await bd.collection('actividades').insertMany(actividades);

  // Último acceso de cada usuario = su último inicio de sesión registrado.
  const ultimos = new Map();
  for (const a of actividades) if (a.accion === 'INICIO_SESION') ultimos.set(a.actor._id.toString(), a.fecha);
  for (const u of usuarios) {
    const ultimo = ultimos.get(u._id.toString());
    if (ultimo) await bd.collection('usuarios').updateOne({ _id: u._id }, { $set: { ultimoAcceso: ultimo } });
  }

  const bytes = documentos.archivos.reduce((s, a) => s + a.contenido.bytes, 0);
  console.log(
    `\n✔ ${usuarios.length} usuarios · ${documentos.carpetas.length} carpetas · ${documentos.archivos.length} archivos en GridFS (${(bytes / 1024).toFixed(1)} KB) · ${actividades.length} actividades\n`,
  );
  console.table(
    usuarios.map((u) => ({
      usuario: u.nombreUsuario,
      nombre: u.nombreCompleto,
      rol: u.rol,
      estado: u.activo ? 'activo' : 'inactivo',
      contraseña: u.rol === 'administrador' ? CLAVE_ADMINISTRADOR : CLAVE_USUARIOS,
    })),
  );
}

try {
  await ejecutar();
} catch (error) {
  console.error('La carga inicial falló:', error.message);
  process.exitCode = 1;
} finally {
  await desconectar();
}
