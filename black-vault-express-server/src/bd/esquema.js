// Esquema de la base de datos: validadores ($jsonSchema + $expr) e índices de cada colección.
// Se aplica al arrancar el servidor y desde la carga inicial. Es idempotente:
// crea lo que falta y actualiza los validadores de las colecciones existentes (collMod).
//
// La justificación de cada decisión está en docs/00-analisis-y-diseno.md (sección 4).

// ---------- Tipos reutilizables ----------
const fecha = { bsonType: 'date' };
const fechaONula = { bsonType: ['date', 'null'] };
const id = { bsonType: 'objectId' };
const idONulo = { bsonType: ['objectId', 'null'] };
const arregloDeIds = { bsonType: 'array', items: id };
// El driver guarda los enteros pequeños como int y $inc puede producir long.
const enteroNoNegativo = { bsonType: ['int', 'long', 'double'], minimum: 0 };
const booleano = { bsonType: 'bool' };
const texto = (minimo, maximo) => ({ bsonType: 'string', minLength: minimo, maxLength: maximo });

export const ROLES = ['administrador', 'usuario'];
export const EXTENSIONES = ['txt', 'md'];
export const TIPOS_MIME = ['text/plain', 'text/markdown'];
export const CATEGORIAS = ['administrativo', 'informe', 'contrato', 'otro'];
export const PERMISOS = ['lectura', 'comentario', 'edicion'];
export const TIPOS_RECURSO = ['archivo', 'carpeta'];
export const CATEGORIAS_ACTIVIDAD = ['autenticacion', 'usuarios', 'carpetas', 'archivos', 'papelera', 'comparticiones'];

const resumenUsuario = {
  bsonType: 'object',
  required: ['_id', 'nombreUsuario', 'nombreCompleto'],
  properties: { _id: id, nombreUsuario: texto(1, 30), nombreCompleto: texto(1, 100) },
};

const estadoPapelera = {
  bsonType: ['object', 'null'],
  required: ['enviadoEn', 'enviadoPor', 'raizId', 'esRaiz'],
  properties: { enviadoEn: fecha, enviadoPor: id, raizId: id, esRaiz: booleano },
};

/**
 * Regla estructural de la jerarquía, garantizada por la propia base de datos:
 * - un elemento nunca es ancestro de sí mismo;
 * - en la raíz (padre null) no hay ancestros;
 * - fuera de la raíz, el último ancestro es exactamente el padre.
 */
function reglaJerarquia(campoPadre) {
  return {
    $expr: {
      $and: [
        { $not: [{ $in: ['$_id', '$ancestros'] }] },
        {
          $cond: [
            { $eq: [`$${campoPadre}`, null] },
            { $eq: [{ $size: '$ancestros' }, 0] },
            { $eq: [{ $arrayElemAt: ['$ancestros', -1] }, `$${campoPadre}`] },
          ],
        },
      ],
    },
  };
}

// ---------- Definición de colecciones ----------
export const COLECCIONES = {
  usuarios: {
    validador: {
      $and: [
        {
          $jsonSchema: {
            bsonType: 'object',
            title: 'Usuario',
            required: ['nombreUsuario', 'correo', 'claveHash', 'nombreCompleto', 'rol', 'activo', 'versionSesion', 'almacenamiento', 'creadoEn', 'actualizadoEn'],
            properties: {
              nombreUsuario: { bsonType: 'string', pattern: '^[a-z0-9._-]{3,30}$' },
              correo: { bsonType: 'string', maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
              claveHash: texto(20, 200),
              nombreCompleto: texto(1, 100),
              rol: { enum: ROLES },
              activo: booleano,
              // Aumenta al cambiar o restablecer la clave y al desactivar: invalida los JWT emitidos antes.
              versionSesion: enteroNoNegativo,
              almacenamiento: {
                bsonType: 'object',
                required: ['usadoBytes', 'cuotaBytes'],
                properties: { usadoBytes: enteroNoNegativo, cuotaBytes: { ...enteroNoNegativo, minimum: 1 } },
              },
              ultimoAcceso: fechaONula,
              desactivadoEn: fechaONula,
              creadoEn: fecha,
              actualizadoEn: fecha,
            },
          },
        },
        // El espacio usado nunca puede superar la cuota.
        { $expr: { $lte: ['$almacenamiento.usadoBytes', '$almacenamiento.cuotaBytes'] } },
      ],
    },
    indices: [
      { key: { nombreUsuario: 1 }, name: 'uq_usuarios_nombreUsuario', unique: true },
      { key: { correo: 1 }, name: 'uq_usuarios_correo', unique: true },
      { key: { rol: 1, activo: 1 }, name: 'ix_usuarios_rol_activo' },
    ],
  },

  carpetas: {
    validador: {
      $and: [
        {
          $jsonSchema: {
            bsonType: 'object',
            title: 'Carpeta',
            required: ['nombre', 'nombreNormalizado', 'propietarioId', 'padreId', 'ancestros', 'creadoPor', 'creadoEn', 'actualizadoEn', 'enPapelera', 'papelera'],
            properties: {
              nombre: texto(1, 255),
              nombreNormalizado: texto(1, 255),
              propietarioId: id,
              padreId: idONulo,
              ancestros: arregloDeIds,
              creadoPor: id,
              creadoEn: fecha,
              actualizadoEn: fecha,
              enPapelera: booleano,
              papelera: estadoPapelera,
            },
          },
        },
        reglaJerarquia('padreId'),
      ],
    },
    indices: [
      {
        key: { padreId: 1, propietarioId: 1, nombreNormalizado: 1 },
        name: 'uq_carpetas_nombre_en_padre',
        unique: true,
        partialFilterExpression: { enPapelera: false },
      },
      { key: { ancestros: 1 }, name: 'ix_carpetas_ancestros' },
      {
        key: { propietarioId: 1, 'papelera.esRaiz': 1, 'papelera.enviadoEn': -1 },
        name: 'ix_carpetas_papelera',
        partialFilterExpression: { enPapelera: true },
      },
      { key: { 'papelera.raizId': 1 }, name: 'ix_carpetas_papelera_raiz', partialFilterExpression: { enPapelera: true } },
    ],
  },

  archivos: {
    validador: {
      $and: [
        {
          $jsonSchema: {
            bsonType: 'object',
            title: 'Archivo',
            required: [
              'nombre', 'nombreNormalizado', 'extension', 'tipoMime', 'categoria', 'etiquetas', 'descripcion',
              'propietarioId', 'carpetaId', 'ancestros', 'contenido', 'comentarios',
              'creadoPor', 'creadoEn', 'actualizadoEn', 'enPapelera', 'papelera',
            ],
            properties: {
              nombre: texto(1, 255),
              nombreNormalizado: texto(1, 255),
              extension: { enum: EXTENSIONES },
              tipoMime: { enum: TIPOS_MIME },
              categoria: { enum: CATEGORIAS },
              etiquetas: { bsonType: 'array', maxItems: 20, uniqueItems: true, items: texto(1, 30) },
              descripcion: texto(0, 500),
              propietarioId: id,
              carpetaId: idONulo,
              ancestros: arregloDeIds,
              contenido: {
                bsonType: 'object',
                required: ['gridFsId', 'bytes', 'sha256', 'version', 'actualizadoEn', 'actualizadoPor'],
                properties: {
                  gridFsId: id,
                  bytes: enteroNoNegativo,
                  sha256: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                  version: { ...enteroNoNegativo, minimum: 1 },
                  actualizadoEn: fecha,
                  actualizadoPor: id,
                },
              },
              comentarios: {
                bsonType: 'array',
                maxItems: 200,
                items: {
                  bsonType: 'object',
                  required: ['_id', 'autor', 'texto', 'creadoEn'],
                  properties: { _id: id, autor: resumenUsuario, texto: texto(1, 1000), creadoEn: fecha },
                },
              },
              creadoPor: id,
              creadoEn: fecha,
              actualizadoEn: fecha,
              enPapelera: booleano,
              papelera: estadoPapelera,
            },
          },
        },
        reglaJerarquia('carpetaId'),
      ],
    },
    indices: [
      {
        key: { carpetaId: 1, propietarioId: 1, nombreNormalizado: 1 },
        name: 'uq_archivos_nombre_en_carpeta',
        unique: true,
        partialFilterExpression: { enPapelera: false },
      },
      { key: { ancestros: 1 }, name: 'ix_archivos_ancestros' },
      { key: { propietarioId: 1, enPapelera: 1, creadoEn: -1 }, name: 'ix_archivos_propietario_fecha' },
      { key: { creadoEn: -1 }, name: 'ix_archivos_fecha' },
      { key: { etiquetas: 1 }, name: 'ix_archivos_etiquetas' },
      {
        key: { nombre: 'text', etiquetas: 'text', descripcion: 'text' },
        name: 'tx_archivos_busqueda',
        weights: { nombre: 10, etiquetas: 5, descripcion: 1 },
        default_language: 'spanish',
      },
      {
        key: { propietarioId: 1, 'papelera.esRaiz': 1, 'papelera.enviadoEn': -1 },
        name: 'ix_archivos_papelera',
        partialFilterExpression: { enPapelera: true },
      },
      { key: { 'papelera.raizId': 1 }, name: 'ix_archivos_papelera_raiz', partialFilterExpression: { enPapelera: true } },
    ],
  },

  comparticiones: {
    validador: {
      $and: [
        {
          $jsonSchema: {
            bsonType: 'object',
            title: 'Compartición',
            required: ['tipoRecurso', 'recursoId', 'propietarioId', 'destinatarioId', 'permiso', 'creadoEn', 'actualizadoEn'],
            properties: {
              tipoRecurso: { enum: TIPOS_RECURSO },
              recursoId: id,
              propietarioId: id,
              destinatarioId: id,
              permiso: { enum: PERMISOS },
              creadoEn: fecha,
              actualizadoEn: fecha,
            },
          },
        },
        // Nadie comparte un recurso consigo mismo.
        { $expr: { $ne: ['$propietarioId', '$destinatarioId'] } },
      ],
    },
    indices: [
      { key: { recursoId: 1, destinatarioId: 1 }, name: 'uq_comparticiones_recurso_destinatario', unique: true },
      { key: { destinatarioId: 1, creadoEn: -1 }, name: 'ix_comparticiones_destinatario' },
      { key: { propietarioId: 1, creadoEn: -1 }, name: 'ix_comparticiones_propietario' },
    ],
  },

  actividades: {
    validador: {
      $jsonSchema: {
        bsonType: 'object',
        title: 'Actividad',
        required: ['accion', 'categoria', 'fecha', 'actor'],
        properties: {
          accion: { bsonType: 'string', pattern: '^[A-Z]+(_[A-Z]+)*$' },
          categoria: { enum: CATEGORIAS_ACTIVIDAD },
          fecha,
          actor: {
            bsonType: 'object',
            required: ['_id', 'nombreUsuario', 'nombreCompleto', 'rol'],
            properties: { ...resumenUsuario.properties, rol: { enum: ROLES } },
          },
          recurso: {
            bsonType: 'object',
            required: ['tipo', '_id', 'nombre', 'propietarioId'],
            properties: { tipo: { enum: TIPOS_RECURSO }, _id: id, nombre: texto(1, 255), propietarioId: id },
          },
          usuarioAfectado: resumenUsuario,
          detalles: { bsonType: 'object' },
          ip: { bsonType: 'string' },
        },
      },
    },
    indices: [
      { key: { 'actor._id': 1, fecha: -1 }, name: 'ix_actividades_actor_fecha' },
      { key: { 'recurso._id': 1, fecha: -1 }, name: 'ix_actividades_recurso_fecha' },
      { key: { 'recurso.propietarioId': 1, fecha: -1 }, name: 'ix_actividades_propietario_fecha' },
      // "Lo que otros hicieron conmigo" (me compartieron algo, desactivaron mi cuenta…).
      { key: { 'usuarioAfectado._id': 1, fecha: -1 }, name: 'ix_actividades_afectado_fecha' },
      { key: { accion: 1, fecha: -1 }, name: 'ix_actividades_accion_fecha' },
      { key: { fecha: -1 }, name: 'ix_actividades_fecha' },
    ],
  },
};

// Colecciones de GridFS (bucket "contenidos"). Sus campos los fija la especificación de GridFS.
// Se crean aquí los mismos índices que crearía el driver en la primera subida, más uno propio.
const INDICES_GRIDFS = {
  'contenidos.files': [
    { key: { filename: 1, uploadDate: 1 }, name: 'filename_1_uploadDate_1' },
    { key: { 'metadata.archivoId': 1 }, name: 'ix_contenidos_archivo' },
  ],
  'contenidos.chunks': [{ key: { files_id: 1, n: 1 }, name: 'files_id_1_n_1', unique: true }],
};

/**
 * Crea o actualiza colecciones, validadores e índices.
 * @param {import('mongodb').Db} bd
 * @returns {Promise<{creadas: string[], actualizadas: string[]}>}
 */
export async function prepararEsquema(bd) {
  const existentes = new Set((await bd.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const creadas = [];
  const actualizadas = [];

  for (const [nombre, definicion] of Object.entries(COLECCIONES)) {
    const opciones = { validator: definicion.validador, validationLevel: 'strict', validationAction: 'error' };
    if (existentes.has(nombre)) {
      await bd.command({ collMod: nombre, ...opciones });
      actualizadas.push(nombre);
    } else {
      await bd.createCollection(nombre, opciones);
      creadas.push(nombre);
    }
    await bd.collection(nombre).createIndexes(definicion.indices);
  }

  for (const [nombre, indices] of Object.entries(INDICES_GRIDFS)) {
    if (!existentes.has(nombre)) {
      await bd.createCollection(nombre);
      creadas.push(nombre);
    }
    await bd.collection(nombre).createIndexes(indices);
  }

  return { creadas, actualizadas };
}
