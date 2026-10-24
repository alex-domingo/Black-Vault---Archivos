// Papelera (diseño, 5.9–5.11): enviar en cascada, listar, restaurar, eliminar definitivamente y vaciar.
//
// Reglas que se mantienen siempre:
// - Ningún elemento activo tiene un ancestro en la papelera.
// - Lo que está en la papelera sigue ocupando espacio hasta eliminarlo definitivamente (I-10).
// - El historial nunca se borra (RN-07).
//
// Sin replica set no hay transacciones: cada operación ordena sus pasos para que un fallo
// a mitad de camino se pueda deshacer (compensación) o lo detecte la verificación de integridad.
import { MongoServerError } from 'mongodb';
import { ejecutarAtomico } from '../../bd/atomico.js';
import { coleccion, haySoporteTransacciones } from '../../bd/conexion.js';
import { liberarCuota } from '../../servicios/cuota.js';
import { eliminarContenido } from '../../servicios/gridfs.js';
import { registrarActividad } from '../../servicios/historial.js';
import { normalizarNombre, siguienteNombreLibre } from '../../servicios/nombres.js';
import { exigirNivel, obtenerAcceso } from '../../servicios/permisos.js';
import { archivoPublico, carpetaPublica, recursoParaHistorial } from '../../servicios/presentacion.js';
import { errores } from '../../utilidades/errores.js';
import { aObjectId } from '../../utilidades/ids.js';
import { aSkipLimit, respuestaPaginada } from '../../utilidades/paginacion.js';
import { escaparRegex } from '../../utilidades/texto.js';
import { pipelineNuevosAncestros } from '../carpetas/carpetas.servicio.js';

const carpetas = () => coleccion('carpetas');
const archivos = () => coleccion('archivos');
const coleccionDe = (tipo) => (tipo === 'archivo' ? archivos() : carpetas());
const campoPadre = (tipo) => (tipo === 'archivo' ? 'carpetaId' : 'padreId');
const esDuplicado = (error) => error instanceof MongoServerError && error.code === 11000;
const ACCION = {
  enviar: { archivo: 'ARCHIVO_ENVIADO_PAPELERA', carpeta: 'CARPETA_ENVIADA_PAPELERA' },
  restaurar: { archivo: 'ARCHIVO_RESTAURADO', carpeta: 'CARPETA_RESTAURADA' },
  eliminar: { archivo: 'ARCHIVO_ELIMINADO_DEFINITIVO', carpeta: 'CARPETA_ELIMINADA_DEFINITIVO' },
};

/** Ejecuta el trabajo; si falla sin transacciones, corre la compensación antes de propagar el error. */
async function conCompensacion(trabajo, compensar) {
  try {
    return await ejecutarAtomico(trabajo);
  } catch (error) {
    if (!haySoporteTransacciones()) {
      try {
        await compensar();
      } catch (fallo) {
        console.error('La compensación también falló; la verificación de integridad lo detectará:', fallo.message);
      }
    }
    throw error;
  }
}

/** Nombre de la carpeta padre (para el historial), o null en la raíz. */
async function resumenPadre(padreId) {
  if (!padreId) return null;
  const padre = await carpetas().findOne({ _id: padreId }, { projection: { nombre: 1 } });
  return padre ? { _id: padre._id, nombre: padre.nombre } : null;
}

// ---------------------------------------------------------------- enviar
/** DELETE /archivos/:id y /carpetas/:id. Solo el propietario. */
export async function enviar(usuario, tipo, id, ip) {
  const acceso = await obtenerAcceso(usuario, tipo, id); // lo que ya está en la papelera responde 404
  exigirNivel(acceso, 'propietario', 'enviar a la papelera');
  const recurso = acceso.recurso;
  const estado = { enviadoEn: new Date(), enviadoPor: usuario._id, raizId: recurso._id };
  const comoRaiz = { $set: { enPapelera: true, papelera: { ...estado, esRaiz: true } } };

  let afectados;
  if (tipo === 'archivo') {
    const { matchedCount } = await archivos().updateOne({ _id: recurso._id, enPapelera: false }, comoRaiz);
    if (matchedCount === 0) throw errores.noEncontrado('El archivo no existe.');
    afectados = { carpetas: 0, archivos: 1 };
  } else {
    // Primero el contenido y al final la carpeta: si algo falla, se devuelve lo que se alcanzó a mover.
    // Lo que ya estaba en la papelera por separado conserva su propia raíz.
    afectados = await conCompensacion(
      async (session) => {
        const interno = { ancestros: recurso._id, enPapelera: false };
        const comoInterno = { $set: { enPapelera: true, papelera: { ...estado, esRaiz: false } } };
        const enCarpetas = await carpetas().updateMany(interno, comoInterno, { session });
        const enArchivos = await archivos().updateMany(interno, comoInterno, { session });
        const { matchedCount } = await carpetas().updateOne({ _id: recurso._id, enPapelera: false }, comoRaiz, { session });
        if (matchedCount === 0) throw errores.noEncontrado('La carpeta no existe.');
        return { carpetas: enCarpetas.modifiedCount + 1, archivos: enArchivos.modifiedCount };
      },
      async () => {
        const deshacer = { $set: { enPapelera: false, papelera: null } };
        await carpetas().updateMany({ 'papelera.raizId': recurso._id, enPapelera: true }, deshacer);
        await archivos().updateMany({ 'papelera.raizId': recurso._id, enPapelera: true }, deshacer);
      },
    );
  }

  await registrarActividad({
    accion: ACCION.enviar[tipo],
    categoria: 'papelera',
    actor: usuario,
    recurso: recursoParaHistorial(tipo, recurso),
    detalles: { ubicacion: await resumenPadre(recurso[campoPadre(tipo)]), elementos: afectados },
    ip,
  });
  return { tipo, _id: recurso._id, nombre: recurso.nombre, elementos: afectados };
}

// ---------------------------------------------------------------- listar
/** Solo las raíces (lo que el usuario envió), con su contenido, tamaño y ubicación original. */
export async function listar(usuario, consulta) {
  const filtro = { propietarioId: usuario._id, enPapelera: true, 'papelera.esRaiz': true };
  if (consulta.buscar) filtro.nombreNormalizado = new RegExp(escaparRegex(normalizarNombre(consulta.buscar)));
  const { skip, limit } = aSkipLimit(consulta);

  const etapasDe = (tipo) => [{ $match: filtro }, { $project: { comentarios: 0 } }, { $set: { tipo, padre: `$${campoPadre(tipo)}` } }];
  const base = consulta.tipo === 'carpeta' ? 'carpeta' : 'archivo';
  const pipeline = [
    ...etapasDe(base),
    // $unionWith junta las raíces de las dos colecciones en una sola lista ordenada.
    ...(consulta.tipo ? [] : [{ $unionWith: { coll: 'carpetas', pipeline: etapasDe('carpeta') } }]),
    { $sort: { 'papelera.enviadoEn': -1, _id: 1 } },
    {
      $facet: {
        total: [{ $count: 'n' }],
        datos: [
          { $skip: skip },
          { $limit: limit },
          // Todo lo que se fue junto con la raíz (incluida ella misma).
          {
            $lookup: {
              from: 'archivos',
              localField: '_id',
              foreignField: 'papelera.raizId',
              pipeline: [{ $group: { _id: null, archivos: { $sum: 1 }, bytes: { $sum: '$contenido.bytes' } } }],
              as: 'contenidoArchivos',
            },
          },
          {
            $lookup: {
              from: 'carpetas',
              localField: '_id',
              foreignField: 'papelera.raizId',
              pipeline: [{ $count: 'n' }],
              as: 'contenidoCarpetas',
            },
          },
          { $lookup: { from: 'carpetas', localField: 'padre', foreignField: '_id', pipeline: [{ $project: { nombre: 1, enPapelera: 1 } }], as: 'padreDoc' } },
          { $lookup: { from: 'carpetas', localField: 'ancestros', foreignField: '_id', pipeline: [{ $project: { nombre: 1 } }], as: 'rutaDocs' } },
        ],
      },
    },
  ];
  const [resultado] = await coleccionDe(base).aggregate(pipeline).toArray();

  const datos = resultado.datos.map((d) => {
    const nombres = new Map(d.rutaDocs.map((c) => [c._id.toString(), c.nombre]));
    const padre = d.padreDoc[0];
    const contenido = d.contenidoArchivos[0] ?? { archivos: 0, bytes: 0 };
    const carpetasInternas = Math.max(0, (d.contenidoCarpetas[0]?.n ?? 0) - (d.tipo === 'carpeta' ? 1 : 0));
    return {
      tipo: d.tipo,
      recurso: d.tipo === 'archivo' ? archivoPublico(d) : carpetaPublica(d),
      enviadoEn: d.papelera.enviadoEn,
      ubicacionOriginal: d.ancestros.map((a) => nombres.get(a.toString()) ?? '(sin nombre)'),
      // Si la carpeta de origen ya no está disponible, se restaura en la raíz (I-11).
      restauraEnRaiz: Boolean(d.padre) && (!padre || padre.enPapelera),
      contenido: { archivos: contenido.archivos, carpetas: carpetasInternas, bytes: contenido.bytes },
    };
  });
  return respuestaPaginada(datos, resultado.total[0]?.n ?? 0, consulta);
}

/** Elemento de la papelera del usuario que se puede restaurar o eliminar (una raíz). */
async function raizEnPapelera(usuario, tipo, id) {
  const mensaje = tipo === 'archivo' ? 'El archivo no está en tu papelera.' : 'La carpeta no está en tu papelera.';
  const recurso = await coleccionDe(tipo).findOne({ _id: aObjectId(id, mensaje) }, { projection: { comentarios: 0 } });
  if (!recurso || !recurso.propietarioId.equals(usuario._id) || !recurso.enPapelera) throw errores.noEncontrado(mensaje);
  if (!recurso.papelera.esRaiz) {
    const raiz = await carpetas().findOne({ _id: recurso.papelera.raizId }, { projection: { nombre: 1 } });
    throw errores.validacion(
      `"${recurso.nombre}" se envió a la papelera junto con la carpeta "${raiz?.nombre ?? '(sin nombre)'}": restaura o elimina esa carpeta.`,
    );
  }
  return recurso;
}

// ---------------------------------------------------------------- restaurar
export async function restaurar(usuario, tipo, id, ip) {
  const recurso = await raizEnPapelera(usuario, tipo, id);
  const campo = campoPadre(tipo);
  const padreId = recurso[campo];
  const padre = padreId ? await carpetas().findOne({ _id: padreId }, { projection: { nombre: 1, enPapelera: 1 } }) : null;
  // Destino: la carpeta original si sigue activa; si no, la raíz del propietario (I-11).
  const alOrigen = !padreId || (padre && !padre.enPapelera);
  const nuevoPadreId = alOrigen ? padreId : null;
  const nuevosAncestros = alOrigen ? recurso.ancestros : [];

  // Lo que se fue junto con la carpeta (lo eliminado antes por separado se queda en la papelera).
  const [idsCarpetas, idsArchivos] =
    tipo === 'carpeta'
      ? await Promise.all([
          carpetas().distinct('_id', { 'papelera.raizId': recurso._id, _id: { $ne: recurso._id } }),
          archivos().distinct('_id', { 'papelera.raizId': recurso._id }),
        ])
      : [[], []];
  const estadoInterno = { ...recurso.papelera, esRaiz: false };

  let nombre;
  for (let intento = 0; ; intento++) {
    nombre = await siguienteNombreLibre(coleccionDe(tipo), { [campo]: nuevoPadreId, propietarioId: recurso.propietarioId }, recurso.nombre, {
      conExtension: tipo === 'archivo',
    });
    try {
      await conCompensacion(
        async (session) => {
          // 1) La raíz primero, en una sola escritura: si el nombre choca (índice único), no cambió nada más.
          const { matchedCount } = await coleccionDe(tipo).updateOne(
            { _id: recurso._id, enPapelera: true },
            {
              $set: {
                [campo]: nuevoPadreId,
                ancestros: nuevosAncestros,
                nombre,
                nombreNormalizado: normalizarNombre(nombre),
                enPapelera: false,
                papelera: null,
                actualizadoEn: new Date(),
              },
            },
            { session },
          );
          if (matchedCount === 0) throw errores.noEncontrado('El elemento ya no está en la papelera.');
          if (tipo === 'carpeta') {
            // 2) Si vuelve a la raíz, sus descendientes cambian de ancestros (como al mover).
            if (!alOrigen) {
              const pipeline = pipelineNuevosAncestros(recurso._id, []);
              await carpetas().updateMany({ ancestros: recurso._id }, pipeline, { session });
              await archivos().updateMany({ ancestros: recurso._id }, pipeline, { session });
            }
            // 3) El contenido que se fue con ella vuelve a estar activo.
            const activar = { $set: { enPapelera: false, papelera: null } };
            await carpetas().updateMany({ _id: { $in: idsCarpetas } }, activar, { session });
            await archivos().updateMany({ _id: { $in: idsArchivos } }, activar, { session });
          }
        },
        async () => {
          // Vuelve todo a como estaba: la raíz a la papelera en su lugar y el contenido con ella.
          await coleccionDe(tipo).updateOne(
            { _id: recurso._id },
            { $set: { [campo]: padreId, ancestros: recurso.ancestros, nombre: recurso.nombre, nombreNormalizado: recurso.nombreNormalizado, enPapelera: true, papelera: recurso.papelera } },
          );
          if (tipo === 'carpeta') {
            if (!alOrigen) {
              const pipeline = pipelineNuevosAncestros(recurso._id, recurso.ancestros);
              await carpetas().updateMany({ ancestros: recurso._id }, pipeline);
              await archivos().updateMany({ ancestros: recurso._id }, pipeline);
            }
            const devolver = { $set: { enPapelera: true, papelera: estadoInterno } };
            await carpetas().updateMany({ _id: { $in: idsCarpetas } }, devolver);
            await archivos().updateMany({ _id: { $in: idsArchivos } }, devolver);
          }
        },
      );
      break;
    } catch (error) {
      // Otro elemento tomó el nombre entre la consulta y la escritura: se prueba el siguiente.
      if (!esDuplicado(error) || intento >= 4) throw error;
    }
  }

  const elementos = { carpetas: tipo === 'carpeta' ? idsCarpetas.length + 1 : 0, archivos: tipo === 'archivo' ? 1 : idsArchivos.length };
  const destino = alOrigen && padre ? { _id: padre._id, nombre: padre.nombre } : null;
  await registrarActividad({
    accion: ACCION.restaurar[tipo],
    categoria: 'papelera',
    actor: usuario,
    recurso: recursoParaHistorial(tipo, { ...recurso, nombre }),
    detalles: {
      destino,
      alOrigen: Boolean(alOrigen),
      ...(nombre !== recurso.nombre ? { nombreAnterior: recurso.nombre } : {}),
      elementos,
    },
    ip,
  });
  return { tipo, _id: recurso._id, nombre, nombreAnterior: recurso.nombre, destino, alOrigen: Boolean(alOrigen), elementos };
}

// ---------------------------------------------------------------- eliminar definitivamente
/**
 * Borra comparticiones, archivos y carpetas, y devuelve el espacio. Al final borra los bytes
 * de GridFS (fuera de la transacción): si eso falla, quedan bytes huérfanos que la
 * verificación de integridad limpia, sin ninguna inconsistencia visible para el usuario.
 */
async function eliminarElementos(propietarioId, idsCarpetas, listaArchivos) {
  const idsArchivos = listaArchivos.map((a) => a._id);
  const bytes = listaArchivos.reduce((suma, a) => suma + a.contenido.bytes, 0);
  await ejecutarAtomico(async (session) => {
    await coleccion('comparticiones').deleteMany({ recursoId: { $in: [...idsCarpetas, ...idsArchivos] } }, { session });
    await archivos().deleteMany({ _id: { $in: idsArchivos }, enPapelera: true }, { session });
    await carpetas().deleteMany({ _id: { $in: idsCarpetas }, enPapelera: true }, { session });
    await liberarCuota(propietarioId, bytes, { session });
  });
  for (const a of listaArchivos) await eliminarContenido(a.contenido.gridFsId);
  return { carpetas: idsCarpetas.length, archivos: idsArchivos.length, bytes };
}

const PROYECCION_BORRADO = { projection: { contenido: 1 } };

export async function eliminarDefinitivo(usuario, tipo, id, ip) {
  const recurso = await raizEnPapelera(usuario, tipo, id);
  let idsCarpetas = [];
  let listaArchivos;
  if (tipo === 'archivo') {
    listaArchivos = [recurso];
  } else {
    const subarbol = { $or: [{ _id: recurso._id }, { ancestros: recurso._id }] };
    // Por la regla de la papelera, todo lo que está dentro también está en ella.
    const activos =
      (await carpetas().countDocuments({ ancestros: recurso._id, enPapelera: false }, { limit: 1 })) +
      (await archivos().countDocuments({ ancestros: recurso._id, enPapelera: false }, { limit: 1 }));
    if (activos > 0) {
      throw errores.conflicto('Hay elementos activos dentro de esta carpeta; no se puede eliminar definitivamente. Ejecuta la verificación de integridad.');
    }
    idsCarpetas = await carpetas().distinct('_id', subarbol);
    listaArchivos = await archivos().find({ ancestros: recurso._id }, PROYECCION_BORRADO).toArray();
  }

  const resultado = await eliminarElementos(usuario._id, idsCarpetas, listaArchivos);
  await registrarActividad({
    accion: ACCION.eliminar[tipo],
    categoria: 'papelera',
    actor: usuario,
    recurso: recursoParaHistorial(tipo, recurso),
    detalles: resultado,
    ip,
  });
  return { tipo, _id: recurso._id, nombre: recurso.nombre, ...resultado };
}

/** Vacía toda la papelera del usuario. */
export async function vaciar(usuario, ip) {
  const filtro = { propietarioId: usuario._id, enPapelera: true };
  const [idsCarpetas, listaArchivos] = await Promise.all([
    carpetas().distinct('_id', filtro),
    archivos().find(filtro, PROYECCION_BORRADO).toArray(),
  ]);
  if (idsCarpetas.length === 0 && listaArchivos.length === 0) return { carpetas: 0, archivos: 0, bytes: 0 };

  const activosDentro =
    (await carpetas().countDocuments({ ancestros: { $in: idsCarpetas }, enPapelera: false }, { limit: 1 })) +
    (await archivos().countDocuments({ ancestros: { $in: idsCarpetas }, enPapelera: false }, { limit: 1 }));
  if (activosDentro > 0) {
    throw errores.conflicto('Hay elementos activos dentro de carpetas de la papelera; no se puede vaciar. Ejecuta la verificación de integridad.');
  }

  const resultado = await eliminarElementos(usuario._id, idsCarpetas, listaArchivos);
  await registrarActividad({ accion: 'PAPELERA_VACIADA', categoria: 'papelera', actor: usuario, detalles: resultado, ip });
  return resultado;
}
