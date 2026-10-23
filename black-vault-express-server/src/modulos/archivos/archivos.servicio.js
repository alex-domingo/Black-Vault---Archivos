// Archivos: subir, consultar, descargar, editar, renombrar, clasificar, mover y buscar
// (secciones 5.2–5.7 del diseño). El contenido vive en GridFS; aquí solo metadatos.
import path from 'node:path';
import { MongoServerError, ObjectId } from 'mongodb';
import { coleccion } from '../../bd/conexion.js';
import { EXTENSIONES } from '../../bd/esquema.js';
import { entorno } from '../../config/entorno.js';
import { liberarCuota, reservarCuota } from '../../servicios/cuota.js';
import { calcularSha256, eliminarContenido, flujoDeDescarga, guardarContenido, leerContenido } from '../../servicios/gridfs.js';
import { registrarActividad } from '../../servicios/historial.js';
import { normalizarNombre, separarExtension, siguienteNombreLibre, validarNombre } from '../../servicios/nombres.js';
import { construirRuta, exigirNivel, obtenerAcceso } from '../../servicios/permisos.js';
import { archivoPublico, recursoParaHistorial, resumenesDeUsuarios } from '../../servicios/presentacion.js';
import { analizarTexto, pareceBinario, reconstruirBytes } from '../../servicios/texto.js';
import { errores } from '../../utilidades/errores.js';
import { finDelDia, inicioDelDia } from '../../utilidades/fechas.js';
import { aObjectId } from '../../utilidades/ids.js';
import { aSkipLimit, respuestaPaginada } from '../../utilidades/paginacion.js';
import { escaparRegex } from '../../utilidades/texto.js';

const archivos = () => coleccion('archivos');
const carpetas = () => coleccion('carpetas');

const TIPOS_MIME = { txt: 'text/plain', md: 'text/markdown' };
const esDuplicado = (error) => error instanceof MongoServerError && error.code === 11000;

/** Carpeta de destino válida para escribir (subir o mover) o null para la raíz. */
async function resolverDestino(usuario, carpetaId, { paraMover = false, propietarioEsperado } = {}) {
  if (!carpetaId) {
    return { carpeta: null, propietarioId: propietarioEsperado ?? usuario._id, ancestros: [] };
  }
  if (paraMover) {
    const carpeta = await carpetas().findOne({ _id: aObjectId(carpetaId, 'La carpeta de destino no existe.') });
    if (!carpeta || carpeta.enPapelera || !carpeta.propietarioId.equals(propietarioEsperado)) {
      throw errores.noEncontrado('La carpeta de destino no existe.');
    }
    return { carpeta, propietarioId: carpeta.propietarioId, ancestros: [...carpeta.ancestros, carpeta._id] };
  }
  const acceso = await obtenerAcceso(usuario, 'carpeta', carpetaId);
  exigirNivel(acceso, 'edicion', 'subir archivos a esta carpeta');
  const carpeta = acceso.recurso;
  // Lo que se sube a una carpeta pertenece al dueño de la carpeta y usa su cuota (diseño, I-12).
  return { carpeta, propietarioId: carpeta.propietarioId, ancestros: [...carpeta.ancestros, carpeta._id] };
}

async function existeNombre(propietarioId, carpetaId, nombre, excluirId) {
  const filtro = { carpetaId, propietarioId, nombreNormalizado: normalizarNombre(nombre), enPapelera: false };
  if (excluirId) filtro._id = { $ne: excluirId };
  return (await archivos().countDocuments(filtro, { limit: 1 })) > 0;
}

// ---------------------------------------------------------------- subir
export async function subir(usuario, archivoRecibido, campos, ip) {
  if (!archivoRecibido) throw errores.validacion('Adjunta un archivo en el campo "archivo".');

  // Algunos navegadores envían la ruta completa; solo interesa el nombre.
  const nombreOriginal = validarNombre(path.win32.basename(archivoRecibido.originalname), 'archivo');
  const { extension } = separarExtension(nombreOriginal);
  if (!EXTENSIONES.includes(extension)) throw errores.tipoNoPermitido();

  const buffer = archivoRecibido.buffer;
  if (pareceBinario(buffer)) throw errores.tipoNoPermitido('El archivo no parece ser de texto (.txt o .md).');

  const destino = await resolverDestino(usuario, campos.carpetaId);
  const bytes = buffer.length;
  const sha256 = calcularSha256(buffer);
  const archivoId = new ObjectId();
  const tipoMime = TIPOS_MIME[extension];

  // 1) Reservar espacio (atómico).  2) Guardar bytes en GridFS.  3) Guardar metadatos.
  // Si 2 o 3 fallan, se compensa: se borra lo escrito y se devuelve el espacio.
  await reservarCuota(destino.propietarioId, bytes);
  let gridFsId;
  try {
    gridFsId = await guardarContenido(buffer, { nombre: nombreOriginal, archivoId, propietarioId: destino.propietarioId, tipoMime, sha256 });

    const ahora = new Date();
    const documento = {
      _id: archivoId,
      nombre: nombreOriginal,
      nombreNormalizado: '',
      extension,
      tipoMime,
      categoria: campos.categoria,
      etiquetas: campos.etiquetas,
      descripcion: campos.descripcion,
      propietarioId: destino.propietarioId,
      carpetaId: destino.carpeta?._id ?? null,
      ancestros: destino.ancestros,
      contenido: { gridFsId, bytes, sha256, version: 1, actualizadoEn: ahora, actualizadoPor: usuario._id },
      comentarios: [],
      creadoPor: usuario._id,
      creadoEn: ahora,
      actualizadoEn: ahora,
      enPapelera: false,
      papelera: null,
    };

    // Si el nombre ya existe en el destino se usa "nombre (1).ext"; el índice único resuelve las carreras.
    for (let intento = 0; ; intento++) {
      documento.nombre = await siguienteNombreLibre(archivos(), { carpetaId: documento.carpetaId, propietarioId: documento.propietarioId }, nombreOriginal);
      documento.nombreNormalizado = normalizarNombre(documento.nombre);
      try {
        await archivos().insertOne(documento);
        break;
      } catch (error) {
        if (!esDuplicado(error) || intento >= 4) throw error;
      }
    }

    await registrarActividad({
      accion: 'ARCHIVO_SUBIDO',
      categoria: 'archivos',
      actor: usuario,
      recurso: recursoParaHistorial('archivo', documento),
      detalles: {
        bytes,
        carpeta: destino.carpeta ? { _id: destino.carpeta._id, nombre: destino.carpeta.nombre } : null,
        ...(documento.nombre !== nombreOriginal ? { nombreOriginal } : {}),
      },
      ip,
    });
    return archivoPublico(documento);
  } catch (error) {
    if (gridFsId) await eliminarContenido(gridFsId);
    await liberarCuota(destino.propietarioId, bytes);
    throw error;
  }
}

// ---------------------------------------------------------------- consultar
export async function detalle(usuario, id) {
  const { recurso, nivel, raizVisible } = await obtenerAcceso(usuario, 'archivo', id);
  const [ruta, usuarios] = await Promise.all([
    construirRuta('archivo', recurso, raizVisible),
    resumenesDeUsuarios([recurso.propietarioId, recurso.creadoPor, recurso.contenido.actualizadoPor]),
  ]);
  const quien = (id) => usuarios.get(id?.toString()) ?? null;
  return {
    ...archivoPublico(recurso),
    propietario: quien(recurso.propietarioId),
    creador: quien(recurso.creadoPor),
    editorContenido: quien(recurso.contenido.actualizadoPor),
    ruta,
    acceso: nivel,
  };
}

/** Texto para la vista previa o el editor. Queda registrado como "consultar" (RF-08). */
export async function leerTexto(usuario, id, ip) {
  const { recurso, nivel } = await obtenerAcceso(usuario, 'archivo', id);
  const buffer = await leerContenido(recurso.contenido.gridFsId);
  const { texto, esUtf8, tieneBom, saltos } = analizarTexto(buffer);

  await registrarActividad({
    accion: 'ARCHIVO_CONSULTADO',
    categoria: 'archivos',
    actor: usuario,
    recurso: recursoParaHistorial('archivo', recurso),
    ip,
  });
  return {
    contenido: texto,
    esUtf8,
    tieneBom,
    saltosDeLinea: saltos,
    version: recurso.contenido.version,
    sha256: recurso.contenido.sha256,
    bytes: recurso.contenido.bytes,
    acceso: nivel,
  };
}

/** Prepara la descarga: devuelve los metadatos y el flujo de GridFS. */
export async function prepararDescarga(usuario, id, ip) {
  const { recurso } = await obtenerAcceso(usuario, 'archivo', id);
  await registrarActividad({
    accion: 'ARCHIVO_DESCARGADO',
    categoria: 'archivos',
    actor: usuario,
    recurso: recursoParaHistorial('archivo', recurso),
    ip,
  });
  return { archivo: recurso, flujo: flujoDeDescarga(recurso.contenido.gridFsId) };
}

// ---------------------------------------------------------------- editar contenido
export async function editarTexto(usuario, id, { contenido, versionEsperada }, ip) {
  const acceso = await obtenerAcceso(usuario, 'archivo', id);
  exigirNivel(acceso, 'edicion', 'editar el contenido de este archivo');
  const archivo = acceso.recurso;

  if (archivo.contenido.version !== versionEsperada) {
    throw errores.conflicto('El archivo cambió mientras lo editabas. Recarga para ver la versión más reciente.', {
      versionActual: archivo.contenido.version,
    });
  }

  const original = analizarTexto(await leerContenido(archivo.contenido.gridFsId));
  if (!original.esUtf8) {
    throw errores.noProcesable('Este archivo no está en UTF-8: editarlo aquí dañaría su contenido. Descárgalo y edítalo en tu equipo.');
  }

  const buffer = reconstruirBytes(contenido, original);
  if (buffer.length > entorno.TAMANO_MAXIMO_BYTES) {
    throw errores.demasiadoGrande(`El contenido supera el tamaño máximo de ${entorno.TAMANO_MAXIMO_MB} MB.`);
  }
  const sha256 = calcularSha256(buffer);
  if (sha256 === archivo.contenido.sha256) {
    return archivoPublico(archivo); // sin cambios reales
  }

  const delta = buffer.length - archivo.contenido.bytes;
  await reservarCuota(archivo.propietarioId, delta); // solo si crece

  let gridFsNuevo;
  try {
    gridFsNuevo = await guardarContenido(buffer, {
      nombre: archivo.nombre,
      archivoId: archivo._id,
      propietarioId: archivo.propietarioId,
      tipoMime: archivo.tipoMime,
      sha256,
    });
    const ahora = new Date();
    const actualizado = await archivos().findOneAndUpdate(
      { _id: archivo._id, 'contenido.version': versionEsperada, enPapelera: false },
      {
        $set: {
          contenido: { gridFsId: gridFsNuevo, bytes: buffer.length, sha256, version: versionEsperada + 1, actualizadoEn: ahora, actualizadoPor: usuario._id },
          actualizadoEn: ahora,
        },
      },
      { returnDocument: 'after', projection: { comentarios: 0 } },
    );
    if (!actualizado) {
      throw errores.conflicto('El archivo cambió mientras lo editabas. Recarga para ver la versión más reciente.');
    }

    await eliminarContenido(archivo.contenido.gridFsId);
    if (delta < 0) await liberarCuota(archivo.propietarioId, -delta);

    await registrarActividad({
      accion: 'ARCHIVO_EDITADO',
      categoria: 'archivos',
      actor: usuario,
      recurso: recursoParaHistorial('archivo', actualizado),
      detalles: { bytesAntes: archivo.contenido.bytes, bytesDespues: buffer.length, version: versionEsperada + 1 },
      ip,
    });
    return archivoPublico(actualizado);
  } catch (error) {
    if (gridFsNuevo) await eliminarContenido(gridFsNuevo);
    if (delta > 0) await liberarCuota(archivo.propietarioId, delta);
    throw error;
  }
}

// ---------------------------------------------------------------- renombrar y clasificar
export async function actualizar(usuario, id, cambios, ip) {
  const acceso = await obtenerAcceso(usuario, 'archivo', id);
  exigirNivel(acceso, 'edicion', 'modificar este archivo');
  const archivo = acceso.recurso;
  const $set = {};
  const detalle = {};

  if (cambios.nombre !== undefined) {
    let nombre = validarNombre(cambios.nombre, 'archivo');
    const { extension } = separarExtension(nombre);
    // La extensión se conserva para que el tipo del archivo no cambie (diseño, 5.5).
    if (extension !== archivo.extension) {
      if (EXTENSIONES.includes(extension)) {
        throw errores.validacion(`No se puede cambiar la extensión: el archivo debe seguir siendo .${archivo.extension}.`);
      }
      nombre = `${nombre}.${archivo.extension}`;
      validarNombre(nombre, 'archivo');
    }
    if (nombre !== archivo.nombre) {
      if (await existeNombre(archivo.propietarioId, archivo.carpetaId, nombre, archivo._id)) {
        throw errores.conflicto(`Ya existe un archivo llamado "${nombre}" en esa carpeta.`);
      }
      $set.nombre = nombre;
      $set.nombreNormalizado = normalizarNombre(nombre);
      detalle.renombrado = { nombreAnterior: archivo.nombre, nombreNuevo: nombre };
    }
  }

  const clasificacion = {};
  for (const campo of ['categoria', 'descripcion']) {
    if (cambios[campo] !== undefined && cambios[campo] !== archivo[campo]) {
      $set[campo] = cambios[campo];
      clasificacion[campo] = { antes: archivo[campo], despues: cambios[campo] };
    }
  }
  if (cambios.etiquetas !== undefined && JSON.stringify(cambios.etiquetas) !== JSON.stringify(archivo.etiquetas)) {
    $set.etiquetas = cambios.etiquetas;
    clasificacion.etiquetas = { antes: archivo.etiquetas, despues: cambios.etiquetas };
  }

  if (Object.keys($set).length === 0) return archivoPublico(archivo);
  $set.actualizadoEn = new Date();

  let actualizado;
  try {
    actualizado = await archivos().findOneAndUpdate({ _id: archivo._id }, { $set }, { returnDocument: 'after', projection: { comentarios: 0 } });
  } catch (error) {
    if (esDuplicado(error)) throw errores.conflicto(`Ya existe un archivo llamado "${$set.nombre}" en esa carpeta.`);
    throw error;
  }

  const recurso = recursoParaHistorial('archivo', actualizado);
  if (detalle.renombrado) {
    await registrarActividad({ accion: 'ARCHIVO_RENOMBRADO', categoria: 'archivos', actor: usuario, recurso, detalles: detalle.renombrado, ip });
  }
  if (Object.keys(clasificacion).length) {
    await registrarActividad({ accion: 'ARCHIVO_ACTUALIZADO', categoria: 'archivos', actor: usuario, recurso, detalles: { cambios: clasificacion }, ip });
  }
  return archivoPublico(actualizado);
}

// ---------------------------------------------------------------- mover
export async function mover(usuario, id, destinoId, ip) {
  const acceso = await obtenerAcceso(usuario, 'archivo', id);
  exigirNivel(acceso, 'propietario', 'mover este archivo');
  const archivo = acceso.recurso;

  const destino = await resolverDestino(usuario, destinoId, { paraMover: true, propietarioEsperado: archivo.propietarioId });
  const nuevaCarpetaId = destino.carpeta?._id ?? null;
  const mismaUbicacion =
    (archivo.carpetaId === null && nuevaCarpetaId === null) ||
    (archivo.carpetaId && nuevaCarpetaId && archivo.carpetaId.equals(nuevaCarpetaId));
  if (mismaUbicacion) return archivoPublico(archivo);

  if (await existeNombre(archivo.propietarioId, nuevaCarpetaId, archivo.nombre, archivo._id)) {
    throw errores.conflicto(`Ya existe un archivo llamado "${archivo.nombre}" en el destino.`);
  }

  const origen = archivo.carpetaId ? await carpetas().findOne({ _id: archivo.carpetaId }, { projection: { nombre: 1 } }) : null;
  let actualizado;
  try {
    actualizado = await archivos().findOneAndUpdate(
      { _id: archivo._id },
      { $set: { carpetaId: nuevaCarpetaId, ancestros: destino.ancestros, actualizadoEn: new Date() } },
      { returnDocument: 'after', projection: { comentarios: 0 } },
    );
  } catch (error) {
    if (esDuplicado(error)) throw errores.conflicto(`Ya existe un archivo llamado "${archivo.nombre}" en el destino.`);
    throw error;
  }

  await registrarActividad({
    accion: 'ARCHIVO_MOVIDO',
    categoria: 'archivos',
    actor: usuario,
    recurso: recursoParaHistorial('archivo', actualizado),
    detalles: {
      origen: origen ? { _id: origen._id, nombre: origen.nombre } : null,
      destino: destino.carpeta ? { _id: destino.carpeta._id, nombre: destino.carpeta.nombre } : null,
    },
    ip,
  });
  return archivoPublico(actualizado);
}

// ---------------------------------------------------------------- buscar
const ORDEN = { nombre: 'nombreNormalizado', fecha: 'actualizadoEn', tamano: 'contenido.bytes', tipo: 'extension' };

/** Filtro de "lo que me compartieron": archivos compartidos directamente o dentro de carpetas compartidas. */
async function filtroCompartidos(usuario) {
  const comparticiones = await coleccion('comparticiones')
    .find({ destinatarioId: usuario._id }, { projection: { tipoRecurso: 1, recursoId: 1 } })
    .toArray();
  const archivosIds = comparticiones.filter((c) => c.tipoRecurso === 'archivo').map((c) => c.recursoId);
  const carpetasIds = comparticiones.filter((c) => c.tipoRecurso === 'carpeta').map((c) => c.recursoId);
  const condiciones = [];
  if (archivosIds.length) condiciones.push({ _id: { $in: archivosIds } });
  if (carpetasIds.length) condiciones.push({ ancestros: { $in: carpetasIds } });
  return condiciones;
}

export async function buscar(usuario, consulta) {
  const filtro = { enPapelera: false }; // RN-04: la papelera nunca aparece en las búsquedas

  if (consulta.alcance === 'propios') {
    filtro.propietarioId = usuario._id;
  } else {
    const compartidos = await filtroCompartidos(usuario);
    if (consulta.alcance === 'compartidos') {
      if (compartidos.length === 0) return respuestaPaginada([], 0, consulta);
      filtro.propietarioId = { $ne: usuario._id };
      filtro.$or = compartidos;
    } else {
      filtro.$or = [{ propietarioId: usuario._id }, ...compartidos];
    }
  }

  if (consulta.buscar) {
    const patron = new RegExp(escaparRegex(normalizarNombre(consulta.buscar)));
    filtro.$and = [{ $or: [{ nombreNormalizado: patron }, { etiquetas: patron }] }];
  }
  if (consulta.tipo) filtro.extension = consulta.tipo;
  if (consulta.categoria) filtro.categoria = consulta.categoria;
  if (consulta.etiqueta) filtro.etiquetas = consulta.etiqueta;
  if (consulta.carpetaId) filtro.ancestros = aObjectId(consulta.carpetaId);
  if (consulta.desde || consulta.hasta) {
    filtro.creadoEn = {};
    if (consulta.desde) filtro.creadoEn.$gte = inicioDelDia(consulta.desde);
    if (consulta.hasta) filtro.creadoEn.$lt = finDelDia(consulta.hasta);
  }

  const porRelevancia = Boolean(consulta.texto);
  if (porRelevancia) filtro.$text = { $search: consulta.texto, $language: 'spanish' };

  const sentido = consulta.direccion === 'asc' ? 1 : -1;
  const orden =
    porRelevancia && consulta.orden === 'relevancia'
      ? { puntaje: { $meta: 'textScore' }, _id: 1 }
      : { [ORDEN[consulta.orden] ?? 'actualizadoEn']: sentido, _id: 1 };
  const { skip, limit } = aSkipLimit(consulta);

  const [resultado] = await archivos()
    .aggregate([
      { $match: filtro },
      ...(porRelevancia ? [{ $set: { puntaje: { $meta: 'textScore' } } }] : []),
      { $sort: orden },
      {
        $facet: {
          total: [{ $count: 'n' }],
          datos: [
            { $skip: skip },
            { $limit: limit },
            { $project: { comentarios: 0 } },
            {
              $lookup: {
                from: 'usuarios',
                localField: 'propietarioId',
                foreignField: '_id',
                pipeline: [{ $project: { nombreUsuario: 1, nombreCompleto: 1 } }],
                as: 'propietario',
              },
            },
            {
              $lookup: {
                from: 'carpetas',
                localField: 'carpetaId',
                foreignField: '_id',
                pipeline: [{ $project: { nombre: 1 } }],
                as: 'carpeta',
              },
            },
          ],
        },
      },
    ])
    .toArray();

  const datos = resultado.datos.map((a) => ({
    ...archivoPublico(a),
    propietario: a.propietario[0] ?? null,
    carpeta: a.carpeta[0] ?? null,
    esPropio: a.propietarioId.equals(usuario._id),
  }));
  return respuestaPaginada(datos, resultado.total[0]?.n ?? 0, consulta);
}
