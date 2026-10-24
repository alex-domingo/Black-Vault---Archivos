// Verificación de integridad (diseño, 5.15). Cada comprobación es una aggregation de MongoDB.
// La usan GET /api/mantenimiento/integridad (administrador), el script `npm run integridad`
// (que además puede reparar con --reparar) y la carga inicial.
import { coleccion, obtenerBucket } from '../bd/conexion.js';

const EJEMPLOS = 10;

/** 1. El espacio usado de cada usuario es la suma de sus archivos (incluida la papelera). */
const espacio = () =>
  coleccion('usuarios')
    .aggregate([
      {
        $lookup: {
          from: 'archivos',
          localField: '_id',
          foreignField: 'propietarioId',
          pipeline: [{ $group: { _id: null, bytes: { $sum: '$contenido.bytes' } } }],
          as: 'suma',
        },
      },
      { $set: { calculado: { $ifNull: [{ $first: '$suma.bytes' }, 0] } } },
      { $match: { $expr: { $ne: ['$almacenamiento.usadoBytes', '$calculado'] } } },
      { $project: { _id: 1, nombreUsuario: 1, registrado: '$almacenamiento.usadoBytes', calculado: 1, cuota: '$almacenamiento.cuotaBytes' } },
    ])
    .toArray();

/** 2. Ningún elemento activo tiene una carpeta ancestro en la papelera. */
const activosBajoPapelera = async () => {
  const pipeline = (tipo) => [
    { $match: { enPapelera: false, 'ancestros.0': { $exists: true } } },
    {
      $lookup: {
        from: 'carpetas',
        localField: 'ancestros',
        foreignField: '_id',
        pipeline: [{ $match: { enPapelera: true } }, { $project: { nombre: 1 } }],
        as: 'ancestrosEnPapelera',
      },
    },
    { $match: { 'ancestrosEnPapelera.0': { $exists: true } } },
    { $project: { _id: 1, tipo: { $literal: tipo }, nombre: 1, propietarioId: 1, carpetaEnPapelera: { $first: '$ancestrosEnPapelera.nombre' } } },
  ];
  const [enCarpetas, enArchivos] = await Promise.all([
    coleccion('carpetas').aggregate(pipeline('carpeta')).toArray(),
    coleccion('archivos').aggregate(pipeline('archivo')).toArray(),
  ]);
  return [...enCarpetas, ...enArchivos];
};

/**
 * 3. "ancestros" coincide con la cadena real de padres ($graphLookup) y todo el árbol
 * pertenece al mismo propietario. En archivos: ancestros = ancestros de su carpeta + su carpeta.
 */
const jerarquia = async () => {
  const carpetas = await coleccion('carpetas')
    .aggregate([
      {
        $graphLookup: {
          from: 'carpetas',
          startWith: '$padreId',
          connectFromField: 'padreId',
          connectToField: '_id',
          as: 'cadena',
          depthField: 'nivel',
          maxDepth: 200,
        },
      },
      {
        $set: {
          esperado: { $map: { input: { $sortArray: { input: '$cadena', sortBy: { nivel: -1 } } }, in: '$$this._id' } },
          otroDueno: { $anyElementTrue: { $map: { input: '$cadena', in: { $ne: ['$$this.propietarioId', '$propietarioId'] } } } },
        },
      },
      { $match: { $expr: { $or: [{ $ne: ['$ancestros', '$esperado'] }, '$otroDueno'] } } },
      { $project: { _id: 1, tipo: { $literal: 'carpeta' }, nombre: 1, ancestros: 1, esperado: 1, otroDueno: 1 } },
    ])
    .toArray();

  const archivos = await coleccion('archivos')
    .aggregate([
      { $lookup: { from: 'carpetas', localField: 'carpetaId', foreignField: '_id', pipeline: [{ $project: { ancestros: 1, propietarioId: 1 } }], as: 'carpeta' } },
      { $set: { carpeta: { $first: '$carpeta' } } },
      {
        $set: {
          esperado: {
            $cond: [
              { $eq: ['$carpetaId', null] },
              [],
              { $cond: [{ $eq: [{ $type: '$carpeta' }, 'missing'] }, null, { $concatArrays: ['$carpeta.ancestros', ['$carpeta._id']] }] },
            ],
          },
          otroDueno: { $and: [{ $ne: ['$carpetaId', null] }, { $ne: ['$carpeta.propietarioId', '$propietarioId'] }] },
        },
      },
      { $match: { $expr: { $or: [{ $ne: ['$ancestros', '$esperado'] }, '$otroDueno'] } } },
      { $project: { _id: 1, tipo: { $literal: 'archivo' }, nombre: 1, ancestros: 1, esperado: 1, otroDueno: 1 } },
    ])
    .toArray();
  return [...carpetas, ...archivos];
};

/** 4. Cada archivo tiene su contenido en GridFS y no hay contenido huérfano. */
const contenido = async () => {
  const [sinContenido, huerfanos, trozosSueltos] = await Promise.all([
    coleccion('archivos')
      .aggregate([
        { $lookup: { from: 'contenidos.files', localField: 'contenido.gridFsId', foreignField: '_id', pipeline: [{ $project: { length: 1 } }], as: 'gridfs' } },
        { $match: { $expr: { $or: [{ $eq: [{ $size: '$gridfs' }, 0] }, { $ne: [{ $first: '$gridfs.length' }, '$contenido.bytes'] }] } } },
        { $project: { _id: 1, problema: { $literal: 'archivo sin su contenido (o de otro tamaño)' }, nombre: 1, gridFsId: '$contenido.gridFsId' } },
      ])
      .toArray(),
    // Se busca por metadata.archivoId (indexado) y se comprueba que el archivo apunte a este contenido.
    coleccion('contenidos.files')
      .aggregate([
        {
          $lookup: {
            from: 'archivos',
            localField: 'metadata.archivoId',
            foreignField: '_id',
            pipeline: [{ $project: { 'contenido.gridFsId': 1 } }],
            as: 'archivo',
          },
        },
        { $match: { $expr: { $ne: [{ $first: '$archivo.contenido.gridFsId' }, '$_id'] } } },
        { $project: { _id: 1, problema: { $literal: 'contenido huérfano' }, nombre: '$filename', bytes: '$length' } },
      ])
      .toArray(),
    coleccion('contenidos.chunks')
      .aggregate([
        { $group: { _id: '$files_id', trozos: { $sum: 1 } } },
        { $lookup: { from: 'contenidos.files', localField: '_id', foreignField: '_id', pipeline: [{ $project: { _id: 1 } }], as: 'archivo' } },
        { $match: { 'archivo.0': { $exists: false } } },
        { $project: { _id: 1, problema: { $literal: 'trozos sin archivo de GridFS' }, trozos: 1 } },
      ])
      .toArray(),
  ]);
  return [...sinContenido, ...huerfanos, ...trozosSueltos];
};

/** 5. Toda compartición apunta a un recurso y a un destinatario que existen, y el dueño coincide. */
const comparticiones = () =>
  coleccion('comparticiones')
    .aggregate([
      { $lookup: { from: 'archivos', localField: 'recursoId', foreignField: '_id', pipeline: [{ $project: { propietarioId: 1 } }], as: 'archivo' } },
      { $lookup: { from: 'carpetas', localField: 'recursoId', foreignField: '_id', pipeline: [{ $project: { propietarioId: 1 } }], as: 'carpeta' } },
      { $lookup: { from: 'usuarios', localField: 'destinatarioId', foreignField: '_id', pipeline: [{ $project: { _id: 1 } }], as: 'destinatario' } },
      { $set: { recurso: { $first: { $cond: [{ $eq: ['$tipoRecurso', 'archivo'] }, '$archivo', '$carpeta'] } } } },
      {
        $match: {
          $expr: {
            $or: [
              { $eq: [{ $type: '$recurso' }, 'missing'] },
              { $ne: ['$recurso.propietarioId', '$propietarioId'] },
              { $eq: [{ $size: '$destinatario' }, 0] },
            ],
          },
        },
      },
      { $project: { _id: 1, tipoRecurso: 1, recursoId: 1, destinatarioId: 1 } },
    ])
    .toArray();

const VERIFICACIONES = [
  { clave: 'espacio', titulo: 'Espacio usado', descripcion: 'El espacio usado de cada usuario es la suma de sus archivos, incluida la papelera.', revisar: espacio, reparable: true },
  { clave: 'papelera', titulo: 'Papelera', descripcion: 'Ningún elemento activo está dentro de una carpeta que está en la papelera.', revisar: activosBajoPapelera, reparable: false },
  { clave: 'jerarquia', titulo: 'Jerarquía de carpetas', descripcion: 'Los ancestros guardados coinciden con la cadena real de carpetas padre y todo el árbol es del mismo propietario.', revisar: jerarquia, reparable: true },
  { clave: 'contenido', titulo: 'Contenido en GridFS', descripcion: 'Cada archivo tiene su contenido en GridFS y no hay contenido sin archivo.', revisar: contenido, reparable: true },
  { clave: 'comparticiones', titulo: 'Comparticiones', descripcion: 'Toda compartición apunta a un recurso y a un usuario que existen.', revisar: comparticiones, reparable: true },
];

/** Ejecuta las cinco comprobaciones. */
export async function verificarIntegridad() {
  const resultados = await Promise.all(
    VERIFICACIONES.map(async ({ clave, titulo, descripcion, revisar, reparable }) => {
      const problemas = await revisar();
      return { clave, titulo, descripcion, reparable, problemas: problemas.length, ejemplos: problemas.slice(0, EJEMPLOS) };
    }),
  );
  return { revisadoEn: new Date(), correcto: resultados.every((r) => r.problemas === 0), verificaciones: resultados };
}

/**
 * Repara lo que se puede reparar sin decidir por el usuario. Lo demás se informa:
 * un elemento activo dentro de la papelera o un archivo sin contenido requieren revisión manual.
 */
export async function repararIntegridad() {
  const reparado = { espacio: 0, jerarquia: 0, contenidoHuerfano: 0, comparticiones: 0 };
  const pendientes = [];

  for (const u of await espacio()) {
    try {
      await coleccion('usuarios').updateOne({ _id: u._id }, { $set: { 'almacenamiento.usadoBytes': u.calculado } });
      reparado.espacio++;
    } catch (error) {
      pendientes.push(`Espacio de ${u.nombreUsuario}: ${error.message} (¿supera su cuota?)`);
    }
  }

  // Primero carpetas y después archivos, porque los ancestros de un archivo salen de los de su carpeta.
  for (const pasada of ['carpeta', 'archivo']) {
    for (const e of (await jerarquia()).filter((x) => x.tipo === pasada)) {
      if (e.otroDueno || e.esperado === null) {
        pendientes.push(`${e.tipo} "${e.nombre}": su carpeta padre no existe o es de otro usuario.`);
        continue;
      }
      await coleccion(pasada === 'carpeta' ? 'carpetas' : 'archivos').updateOne({ _id: e._id }, { $set: { ancestros: e.esperado } });
      reparado.jerarquia++;
    }
  }

  for (const p of await contenido()) {
    if (p.problema === 'contenido huérfano') {
      await obtenerBucket().delete(p._id).catch(() => {});
      reparado.contenidoHuerfano++;
    } else if (p.problema === 'trozos sin archivo de GridFS') {
      await coleccion('contenidos.chunks').deleteMany({ files_id: p._id });
      reparado.contenidoHuerfano++;
    } else {
      pendientes.push(`Archivo "${p.nombre}": no tiene su contenido en GridFS.`);
    }
  }

  const invalidas = await comparticiones();
  if (invalidas.length) {
    const { deletedCount } = await coleccion('comparticiones').deleteMany({ _id: { $in: invalidas.map((c) => c._id) } });
    reparado.comparticiones = deletedCount;
  }

  for (const e of await activosBajoPapelera()) {
    pendientes.push(`${e.tipo} "${e.nombre}" está activo dentro de "${e.carpetaEnPapelera}", que está en la papelera.`);
  }
  return { reparado, pendientes };
}
