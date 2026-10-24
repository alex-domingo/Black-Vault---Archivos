// Comparticiones y comentarios de la carga inicial, con su historial.
// Verifica la coherencia de los datos: fechas posibles, usuarios activos y, para cada
// comentario o archivo subido por otra persona, que tuviera el permiso necesario ese día.
import { ObjectId } from 'mongodb';
import { COMENTARIOS, COMPARTICIONES } from './datos-semilla/comparticiones.js';
import { crearBuscadorDeRutas } from './semilla-rutas.js';

const fechaGt = (texto) => new Date(`${texto}:00-06:00`);
const NIVELES = { lectura: 1, comentario: 2, edicion: 3, propietario: 4 };
const IP = '127.0.0.1';

const actor = (u) => ({ _id: u._id, nombreUsuario: u.nombreUsuario, nombreCompleto: u.nombreCompleto, rol: u.rol });
const resumen = (u) => ({ _id: u._id, nombreUsuario: u.nombreUsuario, nombreCompleto: u.nombreCompleto });
const recurso = (tipo, doc) => ({ tipo, _id: doc._id, nombre: doc.nombre, propietarioId: doc.propietarioId });
const extracto = (texto) => (texto.length > 120 ? `${texto.slice(0, 117)}…` : texto);

function error(mensaje) {
  return new Error(`Datos de comparticiones incoherentes: ${mensaje}`);
}

/**
 * @param {object[]} usuarios
 * @param {object[]} carpetas  Documentos ya insertados.
 * @param {object[]} archivos  Documentos ya insertados.
 * @returns {{ comparticiones: object[], comentarios: Map<string, object[]>, actividades: object[] }}
 */
export function prepararComparticiones(usuarios, carpetas, archivos) {
  const porNombre = new Map(usuarios.map((u) => [u.nombreUsuario, u]));
  const porId = new Map(usuarios.map((u) => [u._id.toString(), u]));
  const usuario = (nombre) => porNombre.get(nombre) ?? (() => { throw error(`no existe el usuario "${nombre}"`); })();

  const buscar = crearBuscadorDeRutas(usuarios, carpetas, archivos, 'Datos de comparticiones incoherentes');

  // ---------- Línea de tiempo de cada compartición ----------
  const lineas = COMPARTICIONES.map((entrada) => {
    const dueno = usuario(entrada.de);
    const destinatario = usuario(entrada.para);
    const doc = buscar(entrada.tipo, entrada.de, entrada.recurso);
    const desde = fechaGt(entrada.fecha);
    const cambios = (entrada.cambios ?? []).map((c) => ({ fecha: fechaGt(c.fecha), permiso: c.permiso }));
    const retirada = entrada.retirada ? fechaGt(entrada.retirada) : null;
    const descripcion = `${entrada.recurso} → ${entrada.para}`;

    if (dueno === destinatario) throw error(`${descripcion}: nadie se comparte algo a sí mismo`);
    if (desde < doc.creadoEn) throw error(`${descripcion}: se comparte antes de existir`);
    if (desde < destinatario.creadoEn || desde < dueno.creadoEn) throw error(`${descripcion}: un usuario aún no existía`);
    if (destinatario.desactivadoEn && desde >= destinatario.desactivadoEn) throw error(`${descripcion}: el destinatario está inactivo`);
    let anterior = desde;
    for (const c of [...cambios, ...(retirada ? [{ fecha: retirada }] : [])]) {
      if (c.fecha <= anterior) throw error(`${descripcion}: las fechas de cambios y retiro deben ir en orden`);
      anterior = c.fecha;
    }
    return { entrada, dueno, destinatario, doc, desde, cambios, retirada };
  });

  const vigentes = new Set();
  for (const l of lineas.filter((x) => !x.retirada)) {
    const clave = `${l.doc._id}|${l.destinatario._id}`;
    if (vigentes.has(clave)) throw error(`${l.entrada.recurso} se comparte dos veces con ${l.entrada.para}`);
    vigentes.add(clave);
  }

  /** Permiso que tenía un usuario sobre un documento en una fecha (propio, directo o heredado). */
  const nivelEn = (u, doc, fecha) => {
    if (doc.propietarioId.equals(u._id)) return NIVELES.propietario;
    const camino = new Set([...doc.ancestros, doc._id].map(String));
    let mayor = 0;
    for (const l of lineas) {
      if (!l.destinatario._id.equals(u._id) || !camino.has(l.doc._id.toString())) continue;
      if (fecha < l.desde || (l.retirada && fecha >= l.retirada)) continue;
      const permiso = [{ fecha: l.desde, permiso: l.entrada.permiso }, ...l.cambios].filter((c) => c.fecha <= fecha).at(-1).permiso;
      mayor = Math.max(mayor, NIVELES[permiso]);
    }
    return mayor;
  };

  // ---------- Documentos e historial de las comparticiones ----------
  const comparticiones = [];
  const actividades = [];
  for (const l of lineas) {
    const tipo = l.entrada.tipo;
    const base = { categoria: 'comparticiones', actor: actor(l.dueno), recurso: recurso(tipo, l.doc), usuarioAfectado: resumen(l.destinatario), ip: IP };
    actividades.push({ ...base, accion: 'COMPARTICION_CREADA', fecha: l.desde, detalles: { permiso: l.entrada.permiso } });
    let permiso = l.entrada.permiso;
    for (const c of l.cambios) {
      actividades.push({ ...base, accion: 'COMPARTICION_MODIFICADA', fecha: c.fecha, detalles: { permisoAnterior: permiso, permisoNuevo: c.permiso } });
      permiso = c.permiso;
    }
    if (l.retirada) {
      actividades.push({ ...base, accion: 'COMPARTICION_RETIRADA', fecha: l.retirada, detalles: { permiso, compartidoDesde: l.desde } });
      continue;
    }
    comparticiones.push({
      _id: new ObjectId(),
      tipoRecurso: tipo,
      recursoId: l.doc._id,
      propietarioId: l.dueno._id,
      destinatarioId: l.destinatario._id,
      permiso,
      creadoEn: l.desde,
      actualizadoEn: l.cambios.at(-1)?.fecha ?? l.desde,
    });
    // Quien recibe un archivo lo abre poco después.
    if (tipo === 'archivo') {
      actividades.push({
        accion: 'ARCHIVO_CONSULTADO',
        categoria: 'archivos',
        fecha: new Date(l.desde.getTime() + 2 * 3600_000),
        actor: actor(l.destinatario),
        recurso: recurso('archivo', l.doc),
        ip: IP,
      });
    }
  }

  // ---------- Archivos subidos por un editor dentro de una carpeta ajena ----------
  for (const a of archivos.filter((x) => !x.creadoPor.equals(x.propietarioId))) {
    if (nivelEn(porId.get(a.creadoPor.toString()), a, a.creadoEn) < NIVELES.edicion) {
      throw error(`"${a.nombre}" lo sube alguien sin permiso de edición en esa fecha`);
    }
  }

  // ---------- Comentarios ----------
  const comentarios = new Map(); // archivoId → [comentario]
  for (const c of COMENTARIOS) {
    const archivo = buscar('archivo', c.de, c.archivo);
    const autor = usuario(c.autor);
    const fecha = fechaGt(c.fecha);
    if (fecha < archivo.creadoEn) throw error(`comentario en "${c.archivo}" anterior al archivo`);
    if (nivelEn(autor, archivo, fecha) < NIVELES.comentario) {
      throw error(`${c.autor} no podía comentar "${c.archivo}" el ${c.fecha}`);
    }
    if (c.texto.length < 1 || c.texto.length > 1000) throw error(`comentario de longitud inválida en "${c.archivo}"`);
    const comentario = { _id: new ObjectId(), autor: resumen(autor), texto: c.texto, creadoEn: fecha };
    const clave = archivo._id.toString();
    comentarios.set(clave, [...(comentarios.get(clave) ?? []), comentario]);

    actividades.push(
      { accion: 'ARCHIVO_CONSULTADO', categoria: 'archivos', fecha: new Date(fecha.getTime() - 5 * 60_000), actor: actor(autor), recurso: recurso('archivo', archivo), ip: IP },
      {
        accion: 'COMENTARIO_AGREGADO',
        categoria: 'archivos',
        fecha,
        actor: actor(autor),
        recurso: recurso('archivo', archivo),
        detalles: { comentarioId: comentario._id, extracto: extracto(c.texto) },
        ip: IP,
      },
    );
  }
  for (const lista of comentarios.values()) lista.sort((a, b) => a.creadoEn - b.creadoEn);

  // nivelEn: permiso de un usuario sobre un documento en una fecha (lo usa el resto del historial).
  return { comparticiones, comentarios, actividades, nivelEn };
}
