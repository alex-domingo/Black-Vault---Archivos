// Carpetas: crear, navegar, renombrar y mover (secciones 5.5, 5.6 y 5.8 del diseño).
import { MongoServerError } from 'mongodb';
import { coleccion } from '../../bd/conexion.js';
import { ejecutarAtomico } from '../../bd/atomico.js';
import { registrarActividad } from '../../servicios/historial.js';
import { normalizarNombre, validarNombre } from '../../servicios/nombres.js';
import { construirRuta, exigirNivel, obtenerAcceso } from '../../servicios/permisos.js';
import {
  archivoPublico,
  carpetaPublica,
  recursoParaHistorial,
  resumenesDeUsuarios,
} from '../../servicios/presentacion.js';
import { errores } from '../../utilidades/errores.js';
import { aObjectId } from '../../utilidades/ids.js';

const carpetas = () => coleccion('carpetas');
const archivos = () => coleccion('archivos');

const ORDEN_ARCHIVOS = {
  nombre: 'nombreNormalizado',
  fecha: 'actualizadoEn',
  tamano: 'contenido.bytes',
  tipo: 'extension',
};

function duplicado(nombre) {
  return errores.conflicto(`Ya existe una carpeta llamada "${nombre}" en ese lugar.`);
}

async function existeNombre(propietarioId, padreId, nombre, excluirId) {
  const filtro = { padreId, propietarioId, nombreNormalizado: normalizarNombre(nombre), enPapelera: false };
  if (excluirId) filtro._id = { $ne: excluirId };
  return (await carpetas().countDocuments(filtro, { limit: 1 })) > 0;
}

/** Marca con "compartido: true" lo que el propietario compartió directamente con alguien. */
async function marcarCompartidos(lista) {
  const elementos = [...lista.carpetas, ...lista.archivos];
  if (elementos.length === 0) return lista;
  const compartidos = new Set(
    (await coleccion('comparticiones').distinct('recursoId', { recursoId: { $in: elementos.map((e) => e._id) } })).map(String),
  );
  for (const elemento of elementos) elemento.compartido = compartidos.has(elemento._id.toString());
  return lista;
}

/** Subcarpetas y archivos activos de un destino (padreId null = raíz del propietario). */
async function listarContenido(propietarioId, padreId, { orden, direccion }) {
  const sentido = direccion === 'desc' ? -1 : 1;
  const [subcarpetas, archivosDelDestino] = await Promise.all([
    // Usa el índice único parcial (padreId, propietarioId, nombreNormalizado).
    carpetas()
      .find({ padreId, propietarioId, enPapelera: false })
      .sort({ nombreNormalizado: orden === 'nombre' ? sentido : 1 })
      .toArray(),
    archivos()
      .find({ carpetaId: padreId, propietarioId, enPapelera: false }, { projection: { comentarios: 0 } })
      .sort({ [ORDEN_ARCHIVOS[orden]]: sentido, nombreNormalizado: 1 })
      .toArray(),
  ]);
  return { carpetas: subcarpetas.map(carpetaPublica), archivos: archivosDelDestino.map(archivoPublico) };
}

export async function contenidoRaiz(usuario, consulta) {
  const contenido = await marcarCompartidos(await listarContenido(usuario._id, null, consulta));
  return { carpeta: null, ruta: [], acceso: 'propietario', ...contenido };
}

export async function contenido(usuario, id, consulta) {
  const { recurso, nivel, raizVisible } = await obtenerAcceso(usuario, 'carpeta', id);
  const [ruta, contenidoCarpeta, duenos] = await Promise.all([
    construirRuta('carpeta', recurso, raizVisible),
    listarContenido(recurso.propietarioId, recurso._id, consulta),
    resumenesDeUsuarios([recurso.propietarioId]),
  ]);
  // Solo el propietario sabe qué está compartido con otras personas.
  const lista = nivel === 'propietario' ? await marcarCompartidos(contenidoCarpeta) : contenidoCarpeta;
  return {
    carpeta: { ...carpetaPublica(recurso), propietario: duenos.get(recurso.propietarioId.toString()) ?? null },
    ruta,
    acceso: nivel,
    ...lista,
  };
}

/** Detalle de una carpeta: propiedad, ubicación (ruta) y cantidad de elementos. */
export async function detalle(usuario, id) {
  const { recurso, nivel, raizVisible } = await obtenerAcceso(usuario, 'carpeta', id);
  const esPropietario = nivel === 'propietario';
  const [ruta, duenos, subcarpetas, archivosDirectos, compartidoCon] = await Promise.all([
    construirRuta('carpeta', recurso, raizVisible),
    resumenesDeUsuarios([recurso.propietarioId, recurso.creadoPor]),
    carpetas().countDocuments({ padreId: recurso._id, enPapelera: false }),
    archivos().countDocuments({ carpetaId: recurso._id, enPapelera: false }),
    esPropietario ? coleccion('comparticiones').countDocuments({ recursoId: recurso._id }) : undefined,
  ]);
  return {
    ...carpetaPublica(recurso),
    propietario: duenos.get(recurso.propietarioId.toString()) ?? null,
    creador: duenos.get(recurso.creadoPor.toString()) ?? null,
    ruta,
    acceso: nivel,
    elementos: { carpetas: subcarpetas, archivos: archivosDirectos },
    ...(esPropietario ? { compartidoCon } : {}),
  };
}

export async function crear(usuario, { nombre, padreId }, ip) {
  const limpio = validarNombre(nombre, 'carpeta');
  let propietarioId = usuario._id;
  let ancestros = [];
  let padre = null;

  if (padreId) {
    const acceso = await obtenerAcceso(usuario, 'carpeta', padreId);
    exigirNivel(acceso, 'edicion', 'crear carpetas aquí');
    padre = acceso.recurso;
    // Lo creado dentro de una carpeta pertenece al dueño de esa carpeta (diseño, I-12).
    propietarioId = padre.propietarioId;
    ancestros = [...padre.ancestros, padre._id];
  }

  if (await existeNombre(propietarioId, padre?._id ?? null, limpio)) throw duplicado(limpio);

  const ahora = new Date();
  const documento = {
    nombre: limpio,
    nombreNormalizado: normalizarNombre(limpio),
    propietarioId,
    padreId: padre?._id ?? null,
    ancestros,
    creadoPor: usuario._id,
    creadoEn: ahora,
    actualizadoEn: ahora,
    enPapelera: false,
    papelera: null,
  };
  try {
    documento._id = (await carpetas().insertOne(documento)).insertedId;
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw duplicado(limpio);
    throw error;
  }

  await registrarActividad({
    accion: 'CARPETA_CREADA',
    categoria: 'carpetas',
    actor: usuario,
    recurso: recursoParaHistorial('carpeta', documento),
    detalles: { padre: padre ? { _id: padre._id, nombre: padre.nombre } : null },
    ip,
  });
  return carpetaPublica(documento);
}

export async function renombrar(usuario, id, nombre, ip) {
  const acceso = await obtenerAcceso(usuario, 'carpeta', id);
  exigirNivel(acceso, 'edicion', 'renombrar esta carpeta');
  const carpeta = acceso.recurso;
  const limpio = validarNombre(nombre, 'carpeta');
  if (limpio === carpeta.nombre) return carpetaPublica(carpeta);

  if (await existeNombre(carpeta.propietarioId, carpeta.padreId, limpio, carpeta._id)) throw duplicado(limpio);

  let actualizada;
  try {
    actualizada = await carpetas().findOneAndUpdate(
      { _id: carpeta._id },
      { $set: { nombre: limpio, nombreNormalizado: normalizarNombre(limpio), actualizadoEn: new Date() } },
      { returnDocument: 'after' },
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw duplicado(limpio);
    throw error;
  }

  // Los descendientes guardan ids en "ancestros", no nombres: no hay que tocarlos.
  await registrarActividad({
    accion: 'CARPETA_RENOMBRADA',
    categoria: 'carpetas',
    actor: usuario,
    recurso: recursoParaHistorial('carpeta', actualizada),
    detalles: { nombreAnterior: carpeta.nombre, nombreNuevo: limpio },
    ip,
  });
  return carpetaPublica(actualizada);
}

/**
 * Pipeline que reescribe "ancestros" en los descendientes de una carpeta movida:
 * [...nuevosAncestrosDeLaCarpeta, carpeta, ...lo que había debajo de la carpeta].
 */
export function pipelineNuevosAncestros(carpetaId, nuevosAncestros) {
  return [
    {
      $set: {
        ancestros: {
          $concatArrays: [
            nuevosAncestros,
            [carpetaId],
            {
              $slice: ['$ancestros', { $add: [{ $indexOfArray: ['$ancestros', carpetaId] }, 1] }, { $size: '$ancestros' }],
            },
          ],
        },
      },
    },
  ];
}

export async function mover(usuario, id, destinoId, ip) {
  const acceso = await obtenerAcceso(usuario, 'carpeta', id);
  exigirNivel(acceso, 'propietario', 'mover esta carpeta');
  const carpeta = acceso.recurso;

  let destino = null;
  if (destinoId) {
    destino = await carpetas().findOne({ _id: aObjectId(destinoId, 'La carpeta de destino no existe.') });
    if (!destino || destino.enPapelera || !destino.propietarioId.equals(carpeta.propietarioId)) {
      throw errores.noEncontrado('La carpeta de destino no existe.');
    }
    // Sin ciclos: no se puede mover dentro de sí misma ni de una de sus subcarpetas (RN-02).
    if (destino._id.equals(carpeta._id) || destino.ancestros.some((a) => a.equals(carpeta._id))) {
      throw errores.conflicto('No puedes mover una carpeta dentro de sí misma ni de una de sus subcarpetas.');
    }
  }

  const nuevoPadreId = destino?._id ?? null;
  if ((carpeta.padreId === null && nuevoPadreId === null) || (carpeta.padreId && nuevoPadreId && carpeta.padreId.equals(nuevoPadreId))) {
    return carpetaPublica(carpeta); // ya está ahí
  }
  if (await existeNombre(carpeta.propietarioId, nuevoPadreId, carpeta.nombre, carpeta._id)) {
    throw errores.conflicto(`Ya existe una carpeta llamada "${carpeta.nombre}" en el destino.`);
  }

  const origen = carpeta.padreId ? await carpetas().findOne({ _id: carpeta.padreId }, { projection: { nombre: 1 } }) : null;
  const nuevosAncestros = destino ? [...destino.ancestros, destino._id] : [];
  const ahora = new Date();

  const afectados = await ejecutarAtomico(async (session) => {
    await carpetas().updateOne(
      { _id: carpeta._id },
      { $set: { padreId: nuevoPadreId, ancestros: nuevosAncestros, actualizadoEn: ahora } },
      { session },
    );
    // Todo el subárbol (incluido lo que esté en la papelera, para que la estructura siga consistente).
    const pipeline = pipelineNuevosAncestros(carpeta._id, nuevosAncestros);
    const enCarpetas = await carpetas().updateMany({ ancestros: carpeta._id }, pipeline, { session });
    const enArchivos = await archivos().updateMany({ ancestros: carpeta._id }, pipeline, { session });
    return { carpetas: enCarpetas.modifiedCount, archivos: enArchivos.modifiedCount };
  });

  await registrarActividad({
    accion: 'CARPETA_MOVIDA',
    categoria: 'carpetas',
    actor: usuario,
    recurso: recursoParaHistorial('carpeta', carpeta),
    detalles: {
      origen: origen ? { _id: origen._id, nombre: origen.nombre } : null,
      destino: destino ? { _id: destino._id, nombre: destino.nombre } : null,
      elementosAfectados: afectados,
    },
    ip,
  });
  return carpetaPublica({ ...carpeta, padreId: nuevoPadreId, ancestros: nuevosAncestros, actualizadoEn: ahora });
}

/** Todas las carpetas activas del usuario (para elegir destino al mover). */
export async function arbol(usuario) {
  return carpetas()
    .find(
      { propietarioId: usuario._id, enPapelera: false },
      { projection: { nombre: 1, padreId: 1, ancestros: 1 } },
    )
    .sort({ nombreNormalizado: 1 })
    .toArray();
}
