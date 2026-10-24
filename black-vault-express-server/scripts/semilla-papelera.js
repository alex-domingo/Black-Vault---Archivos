// Papelera de la carga inicial: aplica las mismas reglas que el servidor (diseño, 5.9–5.11)
// y prepara su historial, incluido el de lo que ya se restauró o se eliminó definitivamente.
import { ObjectId } from 'mongodb';
import { ELIMINADOS, EN_PAPELERA, RESTAURADOS } from './datos-semilla/papelera.js';
import { crearBuscadorDeRutas } from './semilla-rutas.js';

const fechaGt = (texto) => new Date(`${texto}:00-06:00`);
const IP = '127.0.0.1';
const actor = (u) => ({ _id: u._id, nombreUsuario: u.nombreUsuario, nombreCompleto: u.nombreCompleto, rol: u.rol });
const recurso = (tipo, doc) => ({ tipo, _id: doc._id, nombre: doc.nombre, propietarioId: doc.propietarioId });
const error = (mensaje) => new Error(`Datos de papelera incoherentes: ${mensaje}`);

/**
 * Marca en memoria lo que va a la papelera y devuelve las escrituras y el historial.
 * @returns {{ escrituras: object[], actividades: object[], enviados: Map<string, Date> }}
 *   enviados: id → fecha en que dejó de estar activo (para validar el resto del historial).
 */
export function prepararPapelera(usuarios, carpetas, archivos) {
  const porNombre = new Map(usuarios.map((u) => [u.nombreUsuario, u]));
  const buscar = crearBuscadorDeRutas(usuarios, carpetas, archivos, 'Datos de papelera incoherentes');
  const carpetaPorId = new Map(carpetas.map((c) => [c._id.toString(), c]));
  const padreDe = (tipo, doc) => carpetaPorId.get(String(tipo === 'archivo' ? doc.carpetaId : doc.padreId)) ?? null;
  const actividades = [];
  const enviados = new Map();
  const tocados = new Map(); // id → { coleccion, doc }

  for (const entrada of [...EN_PAPELERA].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const dueno = porNombre.get(entrada.usuario);
    const doc = buscar(entrada.tipo, entrada.usuario, entrada.ruta);
    const fecha = fechaGt(entrada.fecha);
    if (doc.enPapelera) throw error(`"${entrada.ruta}" ya estaba en la papelera`);
    if (fecha < doc.creadoEn) throw error(`"${entrada.ruta}" se elimina antes de existir`);

    const estado = { enviadoEn: fecha, enviadoPor: dueno._id, raizId: doc._id };
    doc.enPapelera = true;
    doc.papelera = { ...estado, esRaiz: true };
    tocados.set(doc._id.toString(), { coleccion: entrada.tipo === 'archivo' ? 'archivos' : 'carpetas', doc });
    enviados.set(doc._id.toString(), fecha);
    const elementos = { carpetas: entrada.tipo === 'carpeta' ? 1 : 0, archivos: entrada.tipo === 'archivo' ? 1 : 0 };

    if (entrada.tipo === 'carpeta') {
      // Cascada: lo que ya estaba en la papelera conserva su propia raíz.
      for (const [lista, coleccion] of [[carpetas, 'carpetas'], [archivos, 'archivos']]) {
        for (const interno of lista.filter((x) => !x.enPapelera && x.ancestros.some((a) => a.equals(doc._id)))) {
          interno.enPapelera = true;
          interno.papelera = { ...estado, esRaiz: false };
          tocados.set(interno._id.toString(), { coleccion, doc: interno });
          enviados.set(interno._id.toString(), fecha);
          elementos[coleccion]++;
        }
      }
    }

    const padre = padreDe(entrada.tipo, doc);
    actividades.push({
      accion: entrada.tipo === 'archivo' ? 'ARCHIVO_ENVIADO_PAPELERA' : 'CARPETA_ENVIADA_PAPELERA',
      categoria: 'papelera',
      fecha,
      actor: actor(dueno),
      recurso: recurso(entrada.tipo, doc),
      detalles: { ubicacion: padre ? { _id: padre._id, nombre: padre.nombre } : null, elementos },
      ip: IP,
    });
  }

  // Ida y vuelta: queda en su lugar, pero el historial lo registra.
  for (const r of RESTAURADOS) {
    const dueno = porNombre.get(r.usuario);
    const doc = buscar(r.tipo, r.usuario, r.ruta);
    const [enviado, restaurado] = [fechaGt(r.enviado), fechaGt(r.restaurado)];
    if (enviado < doc.creadoEn || restaurado <= enviado) throw error(`fechas imposibles para "${r.ruta}"`);
    const padre = padreDe(r.tipo, doc);
    const base = { categoria: 'papelera', actor: actor(dueno), recurso: recurso(r.tipo, doc), ip: IP };
    const elementos = { carpetas: r.tipo === 'carpeta' ? 1 : 0, archivos: r.tipo === 'archivo' ? 1 : 0 };
    actividades.push(
      { ...base, accion: r.tipo === 'archivo' ? 'ARCHIVO_ENVIADO_PAPELERA' : 'CARPETA_ENVIADA_PAPELERA', fecha: enviado, detalles: { ubicacion: padre ? { _id: padre._id, nombre: padre.nombre } : null, elementos } },
      { ...base, accion: r.tipo === 'archivo' ? 'ARCHIVO_RESTAURADO' : 'CARPETA_RESTAURADA', fecha: restaurado, detalles: { destino: padre ? { _id: padre._id, nombre: padre.nombre } : null, alOrigen: true, elementos } },
    );
  }

  // Lo que se eliminó definitivamente: solo el historial (un id que ya no existe en ninguna colección).
  for (const e of ELIMINADOS) {
    const dueno = porNombre.get(e.usuario);
    const carpeta = buscar('carpeta', e.usuario, e.ruta);
    const [subido, enviado, eliminado] = [fechaGt(e.subido), fechaGt(e.enviado), fechaGt(e.eliminado)];
    if (subido < carpeta.creadoEn || enviado <= subido || eliminado <= enviado) throw error(`fechas imposibles para "${e.nombre}"`);
    const doc = { _id: new ObjectId(), nombre: e.nombre, propietarioId: dueno._id };
    const base = { categoria: 'archivos', actor: actor(dueno), recurso: recurso('archivo', doc), ip: IP };
    const ubicacion = { _id: carpeta._id, nombre: carpeta.nombre };
    actividades.push(
      { ...base, accion: 'ARCHIVO_SUBIDO', fecha: subido, detalles: { bytes: e.bytes, carpeta: ubicacion } },
      { ...base, categoria: 'papelera', accion: 'ARCHIVO_ENVIADO_PAPELERA', fecha: enviado, detalles: { ubicacion, elementos: { carpetas: 0, archivos: 1 } } },
      { ...base, categoria: 'papelera', accion: 'ARCHIVO_ELIMINADO_DEFINITIVO', fecha: eliminado, detalles: { carpetas: 0, archivos: 1, bytes: e.bytes } },
    );
  }

  const escrituras = [...tocados.values()].map(({ coleccion, doc }) => ({
    coleccion,
    operacion: { updateOne: { filter: { _id: doc._id }, update: { $set: { enPapelera: true, papelera: doc.papelera } } } },
  }));
  return { escrituras, actividades, enviados };
}

/** Nada que esté en la papelera puede tener actividad posterior (salvo la propia de la papelera). */
export function validarHistorialPapelera(actividades, enviados) {
  for (const a of actividades) {
    const desde = a.recurso && enviados.get(a.recurso._id.toString());
    if (desde && a.fecha > desde && a.categoria !== 'papelera') {
      throw error(`"${a.recurso.nombre}" tiene ${a.accion} el ${a.fecha.toISOString()}, después de ir a la papelera`);
    }
  }
}
