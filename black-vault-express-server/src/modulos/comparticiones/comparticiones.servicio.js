// Comparticiones: compartir un archivo o una carpeta con otro usuario, cambiar el permiso
// o retirarlo, y las vistas "compartidos conmigo" y "compartidos por mí" (diseño, 5.12).
//
// Solo el propietario comparte. El permiso de una carpeta alcanza a todo su contenido
// (herencia); el cálculo del permiso efectivo está en servicios/permisos.js.
import { MongoServerError } from 'mongodb';
import { coleccion } from '../../bd/conexion.js';
import { registrarActividad } from '../../servicios/historial.js';
import { normalizarNombre } from '../../servicios/nombres.js';
import { exigirNivel, obtenerAcceso } from '../../servicios/permisos.js';
import { archivoPublico, carpetaPublica, recursoParaHistorial } from '../../servicios/presentacion.js';
import { errores } from '../../utilidades/errores.js';
import { aObjectId } from '../../utilidades/ids.js';
import { aSkipLimit, respuestaPaginada } from '../../utilidades/paginacion.js';
import { escaparRegex } from '../../utilidades/texto.js';

const comparticiones = () => coleccion('comparticiones');
const usuarios = () => coleccion('usuarios');
const coleccionDe = (tipo) => (tipo === 'archivo' ? 'archivos' : 'carpetas');

const DATOS_DESTINATARIO = { nombreUsuario: 1, nombreCompleto: 1, correo: 1, activo: 1 };

/** Lo que el cliente ve de una compartición. */
function comparticionPublica(c, destinatario) {
  return {
    _id: c._id,
    tipoRecurso: c.tipoRecurso,
    recursoId: c.recursoId,
    permiso: c.permiso,
    destinatario: destinatario ?? null,
    creadoEn: c.creadoEn,
    actualizadoEn: c.actualizadoEn,
  };
}

const porNombre = (a, b) => (a.destinatario?.nombreCompleto ?? '').localeCompare(b.destinatario?.nombreCompleto ?? '', 'es');

/** La compartición y su recurso, verificando que quien la toca sea el propietario. */
async function comparticionPropia(usuario, id) {
  const comparticion = await comparticiones().findOne({ _id: aObjectId(id, 'La compartición no existe.') });
  // A quien no es el propietario no se le revela que la compartición existe.
  if (!comparticion || !comparticion.propietarioId.equals(usuario._id)) {
    throw errores.noEncontrado('La compartición no existe.');
  }
  const recurso = await coleccion(coleccionDe(comparticion.tipoRecurso)).findOne(
    { _id: comparticion.recursoId },
    { projection: { nombre: 1, propietarioId: 1, enPapelera: 1 } },
  );
  return { comparticion, recurso };
}

const historialRecurso = (comparticion, recurso) =>
  recurso
    ? recursoParaHistorial(comparticion.tipoRecurso, recurso)
    : { tipo: comparticion.tipoRecurso, _id: comparticion.recursoId, nombre: '(eliminado)', propietarioId: comparticion.propietarioId };

// ---------------------------------------------------------------- quién tiene acceso
/**
 * Acceso a un recurso: comparticiones directas (se pueden cambiar aquí) y heredadas
 * de sus carpetas (se gestionan en la carpeta de la que vienen). Solo el propietario.
 */
export async function accesoDeRecurso(usuario, tipo, id) {
  const acceso = await obtenerAcceso(usuario, tipo, id);
  exigirNivel(acceso, 'propietario', 'ver quién tiene acceso');
  const recurso = acceso.recurso;

  const lista = await comparticiones()
    .find({ recursoId: { $in: [...recurso.ancestros, recurso._id] } })
    .toArray();
  const [personas, carpetas] = await Promise.all([
    usuarios()
      .find({ _id: { $in: lista.map((c) => c.destinatarioId) } }, { projection: DATOS_DESTINATARIO })
      .toArray(),
    coleccion('carpetas')
      .find({ _id: { $in: recurso.ancestros } }, { projection: { nombre: 1 } })
      .toArray(),
  ]);
  const persona = new Map(personas.map((p) => [p._id.toString(), p]));
  const carpeta = new Map(carpetas.map((c) => [c._id.toString(), c]));
  // Más cercana primero: la carpeta padre antes que la raíz.
  const profundidad = new Map(recurso.ancestros.map((a, i) => [a.toString(), i]));

  const directas = [];
  const heredadas = [];
  for (const c of lista) {
    const publica = comparticionPublica(c, persona.get(c.destinatarioId.toString()));
    if (c.recursoId.equals(recurso._id)) {
      directas.push(publica);
    } else {
      const origen = carpeta.get(c.recursoId.toString());
      heredadas.push({ ...publica, desde: { _id: c.recursoId, nombre: origen?.nombre ?? '(sin nombre)' } });
    }
  }
  directas.sort(porNombre);
  heredadas.sort((a, b) => porNombre(a, b) || profundidad.get(b.recursoId.toString()) - profundidad.get(a.recursoId.toString()));

  return {
    recurso: { tipo, _id: recurso._id, nombre: recurso.nombre },
    directas,
    heredadas,
  };
}

// ---------------------------------------------------------------- crear
export async function crear(usuario, { tipoRecurso, recursoId, destinatarioId, permiso }, ip) {
  const acceso = await obtenerAcceso(usuario, tipoRecurso, recursoId);
  exigirNivel(acceso, 'propietario', 'compartir este recurso');
  const recurso = acceso.recurso;

  const idDestinatario = aObjectId(destinatarioId, 'El usuario no existe.');
  if (idDestinatario.equals(usuario._id)) {
    throw errores.validacion('No puedes compartir un recurso contigo mismo.');
  }
  const destinatario = await usuarios().findOne({ _id: idDestinatario }, { projection: DATOS_DESTINATARIO });
  if (!destinatario) throw errores.noEncontrado('El usuario no existe.');
  if (!destinatario.activo) {
    throw errores.conflicto(`${destinatario.nombreCompleto} tiene la cuenta desactivada; no se le pueden compartir recursos.`);
  }

  const yaCompartido = (existente) =>
    errores.conflicto(
      `"${recurso.nombre}" ya está compartido con ${destinatario.nombreCompleto}. Cambia su permiso en lugar de compartirlo otra vez.`,
      { comparticionId: existente?._id },
    );
  const existente = await comparticiones().findOne({ recursoId: recurso._id, destinatarioId: idDestinatario }, { projection: { _id: 1 } });
  if (existente) throw yaCompartido(existente);

  const ahora = new Date();
  const documento = {
    tipoRecurso,
    recursoId: recurso._id,
    propietarioId: recurso.propietarioId,
    destinatarioId: idDestinatario,
    permiso,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
  try {
    documento._id = (await comparticiones().insertOne(documento)).insertedId;
  } catch (error) {
    // Dos peticiones a la vez: el índice único deja pasar solo una.
    if (error instanceof MongoServerError && error.code === 11000) {
      throw yaCompartido(await comparticiones().findOne({ recursoId: recurso._id, destinatarioId: idDestinatario }));
    }
    throw error;
  }

  await registrarActividad({
    accion: 'COMPARTICION_CREADA',
    categoria: 'comparticiones',
    actor: usuario,
    recurso: recursoParaHistorial(tipoRecurso, recurso),
    usuarioAfectado: destinatario,
    detalles: { permiso },
    ip,
  });
  return comparticionPublica(documento, destinatario);
}

// ---------------------------------------------------------------- modificar
export async function modificar(usuario, id, permiso, ip) {
  const { comparticion, recurso } = await comparticionPropia(usuario, id);
  if (!recurso || recurso.enPapelera) {
    throw errores.conflicto('El recurso está en la papelera; restáuralo para cambiar sus permisos.');
  }
  const destinatario = await usuarios().findOne({ _id: comparticion.destinatarioId }, { projection: DATOS_DESTINATARIO });
  if (comparticion.permiso === permiso) return comparticionPublica(comparticion, destinatario);

  const actualizada = await comparticiones().findOneAndUpdate(
    { _id: comparticion._id },
    { $set: { permiso, actualizadoEn: new Date() } },
    { returnDocument: 'after' },
  );
  if (!actualizada) throw errores.noEncontrado('La compartición no existe.');

  await registrarActividad({
    accion: 'COMPARTICION_MODIFICADA',
    categoria: 'comparticiones',
    actor: usuario,
    recurso: historialRecurso(comparticion, recurso),
    usuarioAfectado: destinatario ?? undefined,
    detalles: { permisoAnterior: comparticion.permiso, permisoNuevo: permiso },
    ip,
  });
  return comparticionPublica(actualizada, destinatario);
}

// ---------------------------------------------------------------- retirar
export async function retirar(usuario, id, ip) {
  // Se puede retirar aunque el recurso esté en la papelera: quitar acceso nunca hace daño.
  const { comparticion, recurso } = await comparticionPropia(usuario, id);
  const { deletedCount } = await comparticiones().deleteOne({ _id: comparticion._id });
  if (deletedCount === 0) throw errores.noEncontrado('La compartición no existe.');

  const destinatario = await usuarios().findOne({ _id: comparticion.destinatarioId }, { projection: DATOS_DESTINATARIO });
  // El historial conserva quién tuvo acceso y con qué permiso (RN-07).
  await registrarActividad({
    accion: 'COMPARTICION_RETIRADA',
    categoria: 'comparticiones',
    actor: usuario,
    recurso: historialRecurso(comparticion, recurso),
    usuarioAfectado: destinatario ?? undefined,
    detalles: { permiso: comparticion.permiso, compartidoDesde: comparticion.creadoEn },
    ip,
  });
}

// ---------------------------------------------------------------- listados
/** Etapas comunes: une cada compartición con su archivo o carpeta activos (sin papelera). */
function etapasRecurso({ buscar }) {
  const sinPapelera = (proyeccion) => [{ $match: { enPapelera: false } }, { $project: proyeccion }];
  return [
    {
      $lookup: {
        from: 'archivos',
        localField: 'recursoId',
        foreignField: '_id',
        pipeline: sinPapelera({ comentarios: 0, 'contenido.gridFsId': 0 }),
        as: 'archivo',
      },
    },
    { $lookup: { from: 'carpetas', localField: 'recursoId', foreignField: '_id', pipeline: sinPapelera({ ancestros: 0 }), as: 'carpeta' } },
    { $set: { recurso: { $first: { $concatArrays: ['$archivo', '$carpeta'] } } } },
    { $unset: ['archivo', 'carpeta'] },
    { $match: { 'recurso._id': { $exists: true } } },
    ...(buscar ? [{ $match: { 'recurso.nombreNormalizado': new RegExp(escaparRegex(normalizarNombre(buscar))) } }] : []),
  ];
}

const aRecursoPublico = (tipo, recurso) => (tipo === 'archivo' ? archivoPublico(recurso) : carpetaPublica(recurso));

/** "Compartidos conmigo": lo que otros compartieron directamente con el usuario. */
export async function conmigo(usuario, consulta) {
  const filtro = { destinatarioId: usuario._id };
  if (consulta.tipo) filtro.tipoRecurso = consulta.tipo;
  const { skip, limit } = aSkipLimit(consulta);

  const [resultado] = await comparticiones()
    .aggregate([
      { $match: filtro },
      ...etapasRecurso(consulta),
      { $sort: { creadoEn: -1, _id: 1 } },
      {
        $facet: {
          total: [{ $count: 'n' }],
          datos: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'usuarios',
                localField: 'propietarioId',
                foreignField: '_id',
                pipeline: [{ $project: { nombreUsuario: 1, nombreCompleto: 1 } }],
                as: 'propietario',
              },
            },
          ],
        },
      },
    ])
    .toArray();

  const datos = resultado.datos.map((c) => ({
    _id: c._id,
    tipoRecurso: c.tipoRecurso,
    permiso: c.permiso,
    compartidoEn: c.creadoEn,
    actualizadoEn: c.actualizadoEn,
    recurso: aRecursoPublico(c.tipoRecurso, c.recurso),
    propietario: c.propietario[0] ?? null,
  }));
  return respuestaPaginada(datos, resultado.total[0]?.n ?? 0, consulta);
}

/** "Compartidos por mí": cada recurso propio compartido, con las personas que tienen acceso directo. */
export async function realizadas(usuario, consulta) {
  const filtro = { propietarioId: usuario._id };
  if (consulta.tipo) filtro.tipoRecurso = consulta.tipo;
  const { skip, limit } = aSkipLimit(consulta);

  const [resultado] = await comparticiones()
    .aggregate([
      { $match: filtro },
      ...etapasRecurso(consulta),
      {
        $lookup: {
          from: 'usuarios',
          localField: 'destinatarioId',
          foreignField: '_id',
          pipeline: [{ $project: DATOS_DESTINATARIO }],
          as: 'destinatario',
        },
      },
      {
        $group: {
          _id: '$recursoId',
          tipoRecurso: { $first: '$tipoRecurso' },
          recurso: { $first: '$recurso' },
          ultimoCambio: { $max: '$actualizadoEn' },
          comparticiones: {
            $push: {
              _id: '$_id',
              tipoRecurso: '$tipoRecurso',
              recursoId: '$recursoId',
              permiso: '$permiso',
              destinatario: { $first: '$destinatario' },
              creadoEn: '$creadoEn',
              actualizadoEn: '$actualizadoEn',
            },
          },
        },
      },
      { $sort: { ultimoCambio: -1, _id: 1 } },
      { $facet: { total: [{ $count: 'n' }], datos: [{ $skip: skip }, { $limit: limit }] } },
    ])
    .toArray();

  const datos = resultado.datos.map((g) => ({
    tipoRecurso: g.tipoRecurso,
    recurso: aRecursoPublico(g.tipoRecurso, g.recurso),
    ultimoCambio: g.ultimoCambio,
    comparticiones: g.comparticiones.sort(porNombre),
  }));
  return respuestaPaginada(datos, resultado.total[0]?.n ?? 0, consulta);
}
