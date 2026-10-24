// Reportes del administrador (sección 8 del diseño). Todo se agrupa, acumula y analiza
// dentro de MongoDB con aggregation pipelines (RT-06); aquí solo se arman los pipelines
// y se da forma a la respuesta.
import { coleccion } from '../../bd/conexion.js';
import { entorno } from '../../config/entorno.js';
import { errores } from '../../utilidades/errores.js';
import { finDelDia, hoyEnZona, inicioDelDia, sumarDias } from '../../utilidades/fechas.js';
import { aObjectId } from '../../utilidades/ids.js';
import { aSkipLimit, respuestaPaginada } from '../../utilidades/paginacion.js';

const ZONA = () => entorno.ZONA_HORARIA;
const DATOS_USUARIO = { nombreUsuario: 1, nombreCompleto: 1, activo: 1, rol: 1 };

/** Filtro de fechas { $gte, $lt } con "hasta" inclusivo, o undefined si no hay rango. */
function rangoDeFechas({ desde, hasta }) {
  if (!desde && !hasta) return undefined;
  const filtro = {};
  if (desde) filtro.$gte = inicioDelDia(desde);
  if (hasta) filtro.$lt = finDelDia(hasta);
  return filtro;
}

/** $lookup de un usuario por id, dejando un solo objeto (o null). */
const conUsuario = (campoLocal, como) => [
  { $lookup: { from: 'usuarios', localField: campoLocal, foreignField: '_id', pipeline: [{ $project: DATOS_USUARIO }], as: como } },
  { $set: { [como]: { $ifNull: [{ $first: `$${como}` }, null] } } },
];

/** Une cada compartición con su archivo o carpeta, conservando si está en la papelera. */
const conRecursoCompartido = (proyeccion = { nombre: 1, enPapelera: 1, extension: 1, propietarioId: 1 }) => [
  { $lookup: { from: 'archivos', localField: 'recursoId', foreignField: '_id', pipeline: [{ $project: proyeccion }], as: 'archivo' } },
  { $lookup: { from: 'carpetas', localField: 'recursoId', foreignField: '_id', pipeline: [{ $project: proyeccion }], as: 'carpeta' } },
  { $set: { recurso: { $first: { $concatArrays: ['$archivo', '$carpeta'] } } } },
  { $unset: ['archivo', 'carpeta'] },
];

async function usuarioExistente(usuarioId) {
  const usuario = await coleccion('usuarios').findOne(
    { _id: aObjectId(usuarioId, 'El usuario no existe.') },
    { projection: DATOS_USUARIO },
  );
  if (!usuario) throw errores.noEncontrado('El usuario no existe.');
  return usuario;
}

// ================================================================ períodos
const PASO = { dia: { unidad: 'day', dias: 1 }, semana: { unidad: 'week', dias: 7 }, mes: { unidad: 'month' } };
const MAXIMO_PERIODOS = 400;

/** Primer día del período (día, semana que empieza el lunes, o mes) que contiene a "dia". */
function inicioDePeriodo(dia, unidad) {
  if (unidad === 'mes') return `${dia.slice(0, 8)}01`;
  if (unidad === 'semana') {
    const diaSemana = new Date(`${dia}T00:00:00Z`).getUTCDay(); // 0 = domingo
    return sumarDias(dia, -((diaSemana + 6) % 7));
  }
  return dia;
}

function periodoSiguiente(dia, unidad) {
  if (unidad === 'mes') {
    const [anio, mes] = dia.split('-').map(Number);
    return new Date(Date.UTC(anio, mes, 1)).toISOString().slice(0, 10);
  }
  return sumarDias(dia, PASO[unidad].dias);
}

/** Unidad de la serie de RR-02: día hasta ~2 meses, semana hasta ~1 año, mes más allá (o sin rango). */
function unidadParaRango(desde, hasta) {
  if (!desde || !hasta) return 'mes';
  const dias = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000 + 1;
  return dias <= 62 ? 'dia' : dias <= 400 ? 'semana' : 'mes';
}

// ================================================================ RR-01
/** Cantidad de archivos agrupados por tipo (.txt / .md), con bytes; extra: por categoría. */
export async function archivosPorTipo({ desde, hasta, incluirPapelera }) {
  const filtro = incluirPapelera ? {} : { enPapelera: false };
  const fechas = rangoDeFechas({ desde, hasta });
  if (fechas) filtro.creadoEn = fechas;

  const [r] = await coleccion('archivos')
    .aggregate([
      { $match: filtro },
      {
        $facet: {
          porTipo: [
            {
              $group: {
                _id: '$extension',
                cantidad: { $sum: 1 },
                bytes: { $sum: '$contenido.bytes' },
                promedioBytes: { $avg: '$contenido.bytes' },
                enPapelera: { $sum: { $cond: ['$enPapelera', 1, 0] } },
                ultimaCarga: { $max: '$creadoEn' },
              },
            },
            { $project: { _id: 0, tipo: '$_id', cantidad: 1, bytes: 1, promedioBytes: { $round: ['$promedioBytes', 0] }, enPapelera: 1, ultimaCarga: 1 } },
            { $sort: { cantidad: -1, tipo: 1 } },
          ],
          porCategoria: [
            { $group: { _id: '$categoria', cantidad: { $sum: 1 }, bytes: { $sum: '$contenido.bytes' } } },
            { $project: { _id: 0, categoria: '$_id', cantidad: 1, bytes: 1 } },
            { $sort: { cantidad: -1, categoria: 1 } },
          ],
          total: [{ $group: { _id: null, cantidad: { $sum: 1 }, bytes: { $sum: '$contenido.bytes' } } }, { $project: { _id: 0 } }],
        },
      },
    ])
    .toArray();
  return { porTipo: r.porTipo, porCategoria: r.porCategoria, total: r.total[0] ?? { cantidad: 0, bytes: 0 } };
}

// ================================================================ RR-02
/** Archivos almacenados dentro de un rango de fechas: lista paginada y cargas por día. */
export async function archivosPorFecha(consulta) {
  const filtro = consulta.incluirPapelera ? {} : { enPapelera: false };
  const fechas = rangoDeFechas(consulta);
  if (fechas) filtro.creadoEn = fechas;
  if (consulta.tipo) filtro.extension = consulta.tipo;
  const { skip, limit } = aSkipLimit(consulta);

  // La serie de la gráfica se agrupa por día, semana o mes según el largo del rango,
  // para que nunca tenga más de unas 60 columnas.
  const unidadSerie = unidadParaRango(consulta.desde, consulta.hasta);
  const limites =
    consulta.desde && consulta.hasta
      ? [inicioDelDia(inicioDePeriodo(consulta.desde, unidadSerie)), inicioDelDia(periodoSiguiente(inicioDePeriodo(consulta.hasta, unidadSerie), unidadSerie))]
      : 'full';

  const [[r], serie] = await Promise.all([
    coleccion('archivos')
      .aggregate([
        { $match: filtro },
        { $sort: { creadoEn: -1, _id: 1 } },
        {
          $facet: {
            total: [{ $group: { _id: null, cantidad: { $sum: 1 }, bytes: { $sum: '$contenido.bytes' } } }],
            datos: [
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  nombre: 1, extension: 1, categoria: 1, etiquetas: 1, creadoEn: 1, enPapelera: 1,
                  bytes: '$contenido.bytes', propietarioId: 1, carpetaId: 1,
                },
              },
              ...conUsuario('propietarioId', 'propietario'),
              { $lookup: { from: 'carpetas', localField: 'carpetaId', foreignField: '_id', pipeline: [{ $project: { nombre: 1 } }], as: 'carpeta' } },
              { $set: { carpeta: { $ifNull: [{ $first: '$carpeta.nombre' }, null] } } },
            ],
          },
        },
      ])
      .toArray(),
    // Cargas por período dentro del rango (para la gráfica), con los períodos vacíos en cero.
    coleccion('archivos')
      .aggregate([
        { $match: filtro },
        {
          $group: {
            _id: { $dateTrunc: { date: '$creadoEn', unit: PASO[unidadSerie].unidad, timezone: ZONA(), startOfWeek: 'monday' } },
            cantidad: { $sum: 1 },
          },
        },
        { $project: { _id: 0, periodo: '$_id', cantidad: 1 } },
        { $densify: { field: 'periodo', range: { step: 1, unit: PASO[unidadSerie].unidad, bounds: limites } } },
        { $set: { cantidad: { $ifNull: ['$cantidad', 0] } } },
        { $sort: { periodo: 1 } },
      ])
      .toArray(),
  ]);
  const totales = r.total[0] ?? { cantidad: 0, bytes: 0 };
  return {
    ...respuestaPaginada(r.datos, totales.cantidad, consulta),
    bytes: totales.bytes,
    unidadSerie,
    serie,
  };
}

// ================================================================ RR-03
/** Archivos con más operaciones registradas en el historial (también los ya eliminados). */
export async function archivosMasOperaciones({ desde, hasta, limite }) {
  const filtro = { 'recurso.tipo': 'archivo' };
  const fechas = rangoDeFechas({ desde, hasta });
  if (fechas) filtro.fecha = fechas;

  return coleccion('actividades')
    .aggregate([
      { $match: filtro },
      { $sort: { fecha: 1 } },
      {
        $group: {
          _id: { archivo: '$recurso._id', accion: '$accion' },
          cantidad: { $sum: 1 },
          nombre: { $last: '$recurso.nombre' },
          propietarioId: { $last: '$recurso.propietarioId' },
          ultima: { $max: '$fecha' },
        },
      },
      { $sort: { cantidad: -1, '_id.accion': 1 } },
      {
        $group: {
          _id: '$_id.archivo',
          operaciones: { $sum: '$cantidad' },
          porAccion: { $push: { accion: '$_id.accion', cantidad: '$cantidad' } },
          ultimoNombre: { $last: '$nombre' },
          propietarioId: { $first: '$propietarioId' },
          ultima: { $max: '$ultima' },
        },
      },
      { $sort: { operaciones: -1, ultima: -1 } },
      { $limit: limite },
      // Estado actual: activo, en la papelera o eliminado definitivamente (ya no existe).
      { $lookup: { from: 'archivos', localField: '_id', foreignField: '_id', pipeline: [{ $project: { nombre: 1, enPapelera: 1, extension: 1 } }], as: 'actual' } },
      { $set: { actual: { $first: '$actual' } } },
      {
        $set: {
          nombre: { $ifNull: ['$actual.nombre', '$ultimoNombre'] },
          extension: '$actual.extension',
          estado: { $cond: [{ $not: ['$actual'] }, 'eliminado', { $cond: ['$actual.enPapelera', 'papelera', 'activo'] }] },
        },
      },
      ...conUsuario('propietarioId', 'propietario'),
      { $project: { actual: 0, ultimoNombre: 0, propietarioId: 0 } },
    ])
    .toArray();
}

// ================================================================ RR-04
/** Top de usuarios con más archivos almacenados (activos), con la papelera aparte. */
export async function usuariosMasArchivos({ limite, tipo }) {
  return coleccion('archivos')
    .aggregate([
      ...(tipo ? [{ $match: { extension: tipo } }] : []),
      {
        $group: {
          _id: '$propietarioId',
          activos: { $sum: { $cond: ['$enPapelera', 0, 1] } },
          enPapelera: { $sum: { $cond: ['$enPapelera', 1, 0] } },
          bytes: { $sum: '$contenido.bytes' },
          md: { $sum: { $cond: [{ $eq: ['$extension', 'md'] }, 1, 0] } },
          txt: { $sum: { $cond: [{ $eq: ['$extension', 'txt'] }, 1, 0] } },
        },
      },
      { $sort: { activos: -1, bytes: -1, _id: 1 } },
      { $limit: limite },
      ...conUsuario('_id', 'usuario'),
      { $project: { _id: 0 } },
    ])
    .toArray();
}

// ================================================================ RR-05
/** Usuarios que más recursos compartieron (como propietarios). Sin lo que está en la papelera. */
export async function usuariosMasCompartidos({ limite }) {
  return coleccion('comparticiones')
    .aggregate([
      ...conRecursoCompartido(),
      { $match: { 'recurso.enPapelera': false } },
      {
        $group: {
          _id: '$propietarioId',
          comparticiones: { $sum: 1 },
          recursos: { $addToSet: '$recursoId' },
          destinatarios: { $addToSet: '$destinatarioId' },
          archivos: { $sum: { $cond: [{ $eq: ['$tipoRecurso', 'archivo'] }, 1, 0] } },
          carpetas: { $sum: { $cond: [{ $eq: ['$tipoRecurso', 'carpeta'] }, 1, 0] } },
          lectura: { $sum: { $cond: [{ $eq: ['$permiso', 'lectura'] }, 1, 0] } },
          comentario: { $sum: { $cond: [{ $eq: ['$permiso', 'comentario'] }, 1, 0] } },
          edicion: { $sum: { $cond: [{ $eq: ['$permiso', 'edicion'] }, 1, 0] } },
        },
      },
      { $set: { recursos: { $size: '$recursos' }, destinatarios: { $size: '$destinatarios' } } },
      { $sort: { recursos: -1, comparticiones: -1, _id: 1 } },
      { $limit: limite },
      ...conUsuario('_id', 'usuario'),
      { $project: { _id: 0 } },
    ])
    .toArray();
}

// ================================================================ RR-06
/**
 * Archivos compartidos con más usuarios: acceso directo (compartido el archivo) y
 * efectivo (además, heredado de carpetas compartidas que lo contienen).
 */
export async function archivosMasCompartidos({ limite }) {
  return coleccion('archivos')
    .aggregate([
      { $match: { enPapelera: false } },
      { $set: { ruta: { $concatArrays: ['$ancestros', ['$_id']] } } },
      // localField es un arreglo: trae las comparticiones del archivo y de cada carpeta ancestro.
      { $lookup: { from: 'comparticiones', localField: 'ruta', foreignField: 'recursoId', pipeline: [{ $project: { recursoId: 1, destinatarioId: 1 } }], as: 'acceso' } },
      { $match: { 'acceso.0': { $exists: true } } },
      {
        $set: {
          directos: {
            $setUnion: [{ $map: { input: { $filter: { input: '$acceso', cond: { $eq: ['$$this.recursoId', '$_id'] } } }, in: '$$this.destinatarioId' } }],
          },
          efectivos: { $setUnion: ['$acceso.destinatarioId'] },
        },
      },
      {
        $project: {
          nombre: 1, extension: 1, propietarioId: 1, carpetaId: 1,
          usuariosDirectos: { $size: '$directos' },
          usuariosEfectivos: { $size: '$efectivos' },
          heredados: { $size: { $setDifference: ['$efectivos', '$directos'] } },
        },
      },
      { $sort: { usuariosEfectivos: -1, usuariosDirectos: -1, nombre: 1 } },
      { $limit: limite },
      ...conUsuario('propietarioId', 'propietario'),
      { $lookup: { from: 'carpetas', localField: 'carpetaId', foreignField: '_id', pipeline: [{ $project: { nombre: 1 } }], as: 'carpeta' } },
      { $set: { carpeta: { $ifNull: [{ $first: '$carpeta.nombre' }, null] } } },
      { $project: { propietarioId: 0, carpetaId: 0 } },
    ])
    .toArray();
}

// ================================================================ RR-07 y RR-08
/** Comparticiones de un usuario, como propietario (realizadas) o como destinatario (recibidas). */
async function comparticionesDeUsuario(usuarioId, consulta, comoPropietario) {
  const usuario = await usuarioExistente(usuarioId);
  const filtro = { [comoPropietario ? 'propietarioId' : 'destinatarioId']: usuario._id };
  if (consulta.tipo) filtro.tipoRecurso = consulta.tipo;
  const otro = comoPropietario ? 'destinatarioId' : 'propietarioId';
  const { skip, limit } = aSkipLimit(consulta);

  const [r] = await coleccion('comparticiones')
    .aggregate([
      { $match: filtro },
      ...conRecursoCompartido(),
      { $set: { estado: { $cond: [{ $not: ['$recurso'] }, 'eliminado', { $cond: ['$recurso.enPapelera', 'papelera', 'activo'] }] } } },
      { $sort: { creadoEn: -1, _id: 1 } },
      {
        $facet: {
          total: [{ $count: 'n' }],
          porPermiso: [{ $group: { _id: '$permiso', cantidad: { $sum: 1 } } }, { $project: { _id: 0, permiso: '$_id', cantidad: 1 } }],
          personas: [{ $group: { _id: `$${otro}` } }, { $count: 'n' }],
          datos: [
            { $skip: skip },
            { $limit: limit },
            ...conUsuario(otro, comoPropietario ? 'destinatario' : 'propietario'),
            {
              $project: {
                tipoRecurso: 1, permiso: 1, creadoEn: 1, actualizadoEn: 1, estado: 1,
                recurso: { _id: '$recurso._id', nombre: '$recurso.nombre', extension: '$recurso.extension' },
                destinatario: 1, propietario: 1,
              },
            },
          ],
        },
      },
    ])
    .toArray();

  return {
    usuario,
    ...respuestaPaginada(r.datos, r.total[0]?.n ?? 0, consulta),
    porPermiso: r.porPermiso,
    personas: r.personas[0]?.n ?? 0,
  };
}

export const compartidosPorUsuario = (usuarioId, consulta) => comparticionesDeUsuario(usuarioId, consulta, true);
export const recibidosPorUsuario = (usuarioId, consulta) => comparticionesDeUsuario(usuarioId, consulta, false);

// ================================================================ RR-09
/** Historial de actividad de un usuario dentro de un rango de fechas. */
export async function actividadUsuario(usuarioId, consulta) {
  const usuario = await usuarioExistente(usuarioId);
  const filtro = { 'actor._id': usuario._id };
  const fechas = rangoDeFechas(consulta);
  if (fechas) filtro.fecha = fechas;
  const filtroLista = consulta.categoria ? { ...filtro, categoria: consulta.categoria } : filtro;
  const { skip, limit } = aSkipLimit(consulta);

  const [[r], porCategoria] = await Promise.all([
    coleccion('actividades')
      .aggregate([
        { $match: filtroLista },
        { $sort: { fecha: -1, _id: 1 } },
        { $facet: { total: [{ $count: 'n' }], datos: [{ $skip: skip }, { $limit: limit }] } },
      ])
      .toArray(),
    // El desglose ignora el filtro de categoría para mostrar siempre el panorama completo.
    coleccion('actividades')
      .aggregate([
        { $match: filtro },
        { $group: { _id: '$categoria', cantidad: { $sum: 1 } } },
        { $project: { _id: 0, categoria: '$_id', cantidad: 1 } },
        { $sort: { cantidad: -1 } },
      ])
      .toArray(),
  ]);
  return { usuario, ...respuestaPaginada(r.datos, r.total[0]?.n ?? 0, consulta), porCategoria };
}

// ================================================================ RR-10
/** Cantidad de operaciones agrupadas por tipo (todas las acciones, agrupadas por categoría). */
export async function operacionesPorTipo({ desde, hasta }) {
  const fechas = rangoDeFechas({ desde, hasta });
  const categorias = await coleccion('actividades')
    .aggregate([
      ...(fechas ? [{ $match: { fecha: fechas } }] : []),
      { $group: { _id: { categoria: '$categoria', accion: '$accion' }, cantidad: { $sum: 1 } } },
      { $sort: { cantidad: -1, '_id.accion': 1 } },
      {
        $group: {
          _id: '$_id.categoria',
          total: { $sum: '$cantidad' },
          acciones: { $push: { accion: '$_id.accion', cantidad: '$cantidad' } },
        },
      },
      { $project: { _id: 0, categoria: '$_id', total: 1, acciones: 1 } },
      { $sort: { total: -1, categoria: 1 } },
    ])
    .toArray();
  return { total: categorias.reduce((s, c) => s + c.total, 0), categorias };
}

// ================================================================ RR-11
/**
 * Cantidad de operaciones por período. Los límites se alinean al inicio de la unidad en la
 * zona horaria del sistema: si no, $densify generaría fechas que no coinciden con los grupos.
 */
export async function operacionesPorPeriodo({ desde, hasta, unidad, categoria }) {
  const fin = hasta ?? hoyEnZona();
  const predeterminado = { dia: sumarDias(fin, -29), semana: sumarDias(fin, -7 * 11), mes: `${sumarDias(`${fin.slice(0, 8)}01`, -150).slice(0, 8)}01` };
  const primerDia = inicioDePeriodo(desde ?? predeterminado[unidad], unidad);
  const despuesDelUltimo = periodoSiguiente(inicioDePeriodo(fin, unidad), unidad);

  let periodos = 0;
  for (let d = primerDia; d < despuesDelUltimo && periodos <= MAXIMO_PERIODOS; d = periodoSiguiente(d, unidad)) periodos++;
  if (periodos > MAXIMO_PERIODOS) {
    throw errores.validacion(`El rango es demasiado amplio para agrupar por ${unidad}: elige un rango menor o una unidad mayor.`);
  }

  const inicio = inicioDelDia(primerDia);
  const limite = inicioDelDia(despuesDelUltimo);
  const filtro = { fecha: { $gte: inicio, $lt: limite } };
  if (categoria) filtro.categoria = categoria;
  const truncar = { date: '$fecha', unit: PASO[unidad].unidad, timezone: ZONA(), startOfWeek: 'monday' };

  const serie = await coleccion('actividades')
    .aggregate([
      { $match: filtro },
      { $group: { _id: { periodo: { $dateTrunc: truncar }, categoria: '$categoria' }, cantidad: { $sum: 1 } } },
      { $sort: { cantidad: -1 } },
      {
        $group: {
          _id: '$_id.periodo',
          cantidad: { $sum: '$cantidad' },
          porCategoria: { $push: { categoria: '$_id.categoria', cantidad: '$cantidad' } },
        },
      },
      { $project: { _id: 0, periodo: '$_id', cantidad: 1, porCategoria: 1 } },
      { $densify: { field: 'periodo', range: { step: 1, unit: PASO[unidad].unidad === 'week' ? 'week' : PASO[unidad].unidad, bounds: [inicio, limite] } } },
      { $set: { cantidad: { $ifNull: ['$cantidad', 0] }, porCategoria: { $ifNull: ['$porCategoria', []] } } },
      { $sort: { periodo: 1 } },
    ])
    .toArray();

  return {
    unidad,
    desde: primerDia,
    hasta: sumarDias(despuesDelUltimo, -1),
    total: serie.reduce((s, p) => s + p.cantidad, 0),
    serie,
  };
}

// ================================================================ RR-12
/** Principales acciones: ranking con % del total, usuarios distintos y quién más la realiza. */
export async function principalesAcciones({ desde, hasta, limite }) {
  const fechas = rangoDeFechas({ desde, hasta });
  return coleccion('actividades')
    .aggregate([
      ...(fechas ? [{ $match: { fecha: fechas } }] : []),
      {
        $group: {
          _id: { accion: '$accion', actor: '$actor._id' },
          cantidad: { $sum: 1 },
          categoria: { $first: '$categoria' },
          nombre: { $last: '$actor.nombreCompleto' },
          nombreUsuario: { $last: '$actor.nombreUsuario' },
          ultima: { $max: '$fecha' },
        },
      },
      { $sort: { cantidad: -1, nombreUsuario: 1 } },
      {
        $group: {
          _id: '$_id.accion',
          categoria: { $first: '$categoria' },
          cantidad: { $sum: '$cantidad' },
          usuariosDistintos: { $sum: 1 },
          usuarioPrincipal: { $first: { _id: '$_id.actor', nombreUsuario: '$nombreUsuario', nombreCompleto: '$nombre', cantidad: '$cantidad' } },
          ultima: { $max: '$ultima' },
        },
      },
      { $setWindowFields: { output: { totalGeneral: { $sum: '$cantidad', window: { documents: ['unbounded', 'unbounded'] } } } } },
      {
        $project: {
          _id: 0,
          accion: '$_id',
          categoria: 1,
          cantidad: 1,
          usuariosDistintos: 1,
          usuarioPrincipal: 1,
          ultima: 1,
          porcentaje: { $round: [{ $multiply: [{ $divide: ['$cantidad', '$totalGeneral'] }, 100] }, 1] },
        },
      },
      { $sort: { cantidad: -1, accion: 1 } },
      { $limit: limite },
    ])
    .toArray();
}

// ================================================================ Resumen
/** Panel del administrador: el estado general del sistema en una consulta por colección. */
export async function resumen() {
  const hace30 = inicioDelDia(sumarDias(hoyEnZona(), -29));
  const [[usuarios], [archivos], [carpetas], [comparticiones], [actividad]] = await Promise.all([
    coleccion('usuarios')
      .aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            activos: { $sum: { $cond: ['$activo', 1, 0] } },
            administradores: { $sum: { $cond: [{ $eq: ['$rol', 'administrador'] }, 1, 0] } },
            usadoBytes: { $sum: '$almacenamiento.usadoBytes' },
            cuotaBytes: { $sum: '$almacenamiento.cuotaBytes' },
          },
        },
        { $set: { inactivos: { $subtract: ['$total', '$activos'] } } },
        { $project: { _id: 0 } },
      ])
      .toArray(),
    coleccion('archivos')
      .aggregate([
        {
          $group: {
            _id: null,
            activos: { $sum: { $cond: ['$enPapelera', 0, 1] } },
            enPapelera: { $sum: { $cond: ['$enPapelera', 1, 0] } },
            bytes: { $sum: '$contenido.bytes' },
            bytesPapelera: { $sum: { $cond: ['$enPapelera', '$contenido.bytes', 0] } },
            comentarios: { $sum: { $size: '$comentarios' } },
          },
        },
        { $project: { _id: 0 } },
      ])
      .toArray(),
    coleccion('carpetas')
      .aggregate([{ $group: { _id: null, activas: { $sum: { $cond: ['$enPapelera', 0, 1] } }, enPapelera: { $sum: { $cond: ['$enPapelera', 1, 0] } } } }, { $project: { _id: 0 } }])
      .toArray(),
    coleccion('comparticiones')
      .aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            archivos: { $sum: { $cond: [{ $eq: ['$tipoRecurso', 'archivo'] }, 1, 0] } },
            carpetas: { $sum: { $cond: [{ $eq: ['$tipoRecurso', 'carpeta'] }, 1, 0] } },
          },
        },
        { $project: { _id: 0 } },
      ])
      .toArray(),
    coleccion('actividades')
      .aggregate([
        {
          $facet: {
            total: [{ $count: 'n' }],
            ultimos30: [
              { $match: { fecha: { $gte: hace30 } } },
              { $group: { _id: { $dateTrunc: { date: '$fecha', unit: 'day', timezone: ZONA() } }, cantidad: { $sum: 1 } } },
              { $project: { _id: 0, periodo: '$_id', cantidad: 1 } },
            ],
          },
        },
      ])
      .toArray(),
  ]);

  // Serie de 30 días completa (los días sin actividad en cero).
  const porDia = new Map(actividad.ultimos30.map((d) => [d.periodo.getTime(), d.cantidad]));
  const ultimos30Dias = Array.from({ length: 30 }, (_, i) => {
    const periodo = inicioDelDia(sumarDias(hoyEnZona(), i - 29));
    return { periodo, cantidad: porDia.get(periodo.getTime()) ?? 0 };
  });

  return {
    usuarios: usuarios ?? { total: 0, activos: 0, inactivos: 0, administradores: 0, usadoBytes: 0, cuotaBytes: 0 },
    archivos: archivos ?? { activos: 0, enPapelera: 0, bytes: 0, bytesPapelera: 0, comentarios: 0 },
    carpetas: carpetas ?? { activas: 0, enPapelera: 0 },
    comparticiones: comparticiones ?? { total: 0, archivos: 0, carpetas: 0 },
    actividad: {
      total: actividad.total[0]?.n ?? 0,
      ultimos30Dias,
      ultimos30Total: ultimos30Dias.reduce((s, d) => s + d.cantidad, 0),
    },
  };
}
