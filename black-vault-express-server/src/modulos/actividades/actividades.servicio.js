// Consulta del historial (diseño, sección 6).
//
// - Un usuario ve lo que hizo, lo que otros hicieron con sus recursos y lo que otros hicieron
//   con él (por ejemplo, compartirle algo o desactivar su cuenta).
// - El administrador ve todo y puede filtrar por usuario.
// - La línea de tiempo de un recurso la ven su propietario y el administrador; sirve también
//   para recursos ya eliminados definitivamente, porque el historial no se borra (RN-07).
import { coleccion } from '../../bd/conexion.js';
import { obtenerAcceso } from '../../servicios/permisos.js';
import { errores } from '../../utilidades/errores.js';
import { finDelDia, inicioDelDia } from '../../utilidades/fechas.js';
import { aObjectId } from '../../utilidades/ids.js';
import { aSkipLimit, respuestaPaginada } from '../../utilidades/paginacion.js';

const actividades = () => coleccion('actividades');
const esAdministrador = (usuario) => usuario.rol === 'administrador';

/** La IP solo la ve el administrador. */
const proyeccionPara = (usuario) => (esAdministrador(usuario) ? {} : { ip: 0 });

function filtroComun(consulta) {
  const filtro = {};
  if (consulta.categoria) filtro.categoria = consulta.categoria;
  if (consulta.accion) filtro.accion = consulta.accion;
  if (consulta.desde || consulta.hasta) {
    filtro.fecha = {};
    if (consulta.desde) filtro.fecha.$gte = inicioDelDia(consulta.desde);
    if (consulta.hasta) filtro.fecha.$lt = finDelDia(consulta.hasta);
  }
  return filtro;
}

async function pagina(filtro, consulta, usuario) {
  const { skip, limit } = aSkipLimit(consulta);
  const [datos, total] = await Promise.all([
    actividades().find(filtro, { projection: proyeccionPara(usuario) }).sort({ fecha: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    actividades().countDocuments(filtro),
  ]);
  return respuestaPaginada(datos, total, consulta);
}

/**
 * alcance: 'todo' (lo que me corresponde ver; para el administrador, todo el sistema),
 * 'mias' (lo que hice), 'mis-recursos' (lo que otros hicieron con lo mío),
 * 'conmigo' (lo que otros hicieron conmigo).
 */
export async function listar(usuario, consulta) {
  const yo = usuario._id;
  const filtro = filtroComun(consulta);

  switch (consulta.alcance) {
    case 'mias':
      filtro['actor._id'] = yo;
      break;
    case 'mis-recursos':
      filtro['recurso.propietarioId'] = yo;
      filtro['actor._id'] = { $ne: yo };
      break;
    case 'conmigo':
      filtro['usuarioAfectado._id'] = yo;
      filtro['actor._id'] = { $ne: yo };
      break;
    default:
      // Cada rama del $or tiene su índice, así que no se recorre toda la colección.
      if (!esAdministrador(usuario)) filtro.$or = [{ 'actor._id': yo }, { 'recurso.propietarioId': yo }, { 'usuarioAfectado._id': yo }];
  }

  if (consulta.usuarioId) {
    if (!esAdministrador(usuario)) throw errores.prohibido('Solo el administrador puede consultar la actividad de otros usuarios.');
    if (consulta.alcance !== 'todo') throw errores.validacion('El filtro por usuario solo se combina con el alcance "todo".');
    filtro['actor._id'] = aObjectId(consulta.usuarioId, 'El usuario no existe.');
  }
  return pagina(filtro, consulta, usuario);
}

/** Línea de tiempo de un archivo o una carpeta. */
export async function deRecurso(usuario, tipo, id, consulta) {
  const mensaje = tipo === 'archivo' ? 'El archivo no existe.' : 'La carpeta no existe.';
  const idRecurso = aObjectId(id, mensaje);

  if (!esAdministrador(usuario)) {
    const documento = await coleccion(tipo === 'archivo' ? 'archivos' : 'carpetas').findOne(
      { _id: idRecurso },
      { projection: { propietarioId: 1 } },
    );
    let esPropietario;
    if (documento) {
      esPropietario = documento.propietarioId.equals(usuario._id);
      if (!esPropietario) {
        // Quien tiene acceso compartido sabe que existe: 403. Si no, 404.
        await obtenerAcceso(usuario, tipo, idRecurso);
        throw errores.prohibido('Solo el propietario puede ver la actividad de este recurso.');
      }
    } else {
      // Eliminado definitivamente: el historial dice de quién era.
      esPropietario =
        (await actividades().countDocuments(
          { 'recurso._id': idRecurso, 'recurso.tipo': tipo, 'recurso.propietarioId': usuario._id },
          { limit: 1 },
        )) > 0;
      if (!esPropietario) throw errores.noEncontrado(mensaje);
    }
  }

  const filtro = { ...filtroComun(consulta), 'recurso._id': idRecurso, 'recurso.tipo': tipo };
  return pagina(filtro, consulta, usuario);
}
