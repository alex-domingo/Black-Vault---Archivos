// Historial complementario de la carga inicial: ediciones, cambios de nombre, movimientos,
// clasificación, comentarios borrados, sesiones y administración de cuentas, más el uso
// cotidiano (lecturas y descargas) generado con una semilla fija.
//
// Todo se aplica también a los documentos (versión, cuota, versión de sesión…) y se reescribe
// el historial anterior a cada cambio de nombre o de lugar, porque el historial guarda una
// copia de cómo eran las cosas en ese momento (patrón Extended Reference).
import { ObjectId } from 'mongodb';
import { ARCHIVOS } from './datos-semilla/estructura.js';
import {
  ADMINISTRACION,
  CLASIFICACIONES,
  CLAVES_CAMBIADAS,
  COMENTARIOS_BORRADOS,
  EDICIONES,
  MOVIMIENTOS,
  RENOMBRES,
  SESIONES_FALLIDAS,
  USO,
} from './datos-semilla/historia.js';
import { crearBuscadorDeRutas } from './semilla-rutas.js';
import { separarExtension } from '../src/servicios/nombres.js';

const fechaGt = (texto) => new Date(`${texto}:00-06:00`);
const IP = '127.0.0.1';
const MB = 1024 * 1024;
const NIVEL = { lectura: 1, comentario: 2, edicion: 3, propietario: 4 };
const actor = (u) => ({ _id: u._id, nombreUsuario: u.nombreUsuario, nombreCompleto: u.nombreCompleto, rol: u.rol });
const resumen = (u) => ({ _id: u._id, nombreUsuario: u.nombreUsuario, nombreCompleto: u.nombreCompleto });
const recurso = (tipo, doc) => ({ tipo, _id: doc._id, nombre: doc.nombre, propietarioId: doc.propietarioId });
const lugar = (carpeta) => (carpeta ? { _id: carpeta._id, nombre: carpeta.nombre } : null);
const extracto = (texto) => (texto.length > 120 ? `${texto.slice(0, 117)}…` : texto);
const error = (mensaje) => new Error(`Datos del historial incoherentes: ${mensaje}`);
const max = (...fechas) => new Date(Math.max(...fechas.map((f) => f.getTime())));

/** Generador pseudoaleatorio con semilla (mulberry32): la carga siempre produce lo mismo. */
function generador(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {object} p
 * @param {object[]} p.usuarios
 * @param {object[]} p.carpetas   Documentos en memoria (estado final).
 * @param {object[]} p.archivos   Documentos en memoria (estado final).
 * @param {(u: object, doc: object, fecha: Date) => number} p.nivelEn  Permiso en una fecha (0 = sin acceso).
 * @param {Map<string, Date>} p.enviados  id → fecha en que fue a la papelera.
 */
export function prepararHistoria({ usuarios, carpetas, archivos, nivelEn, enviados }) {
  const porNombre = new Map(usuarios.map((u) => [u.nombreUsuario, u]));
  const usuario = (nombre) => porNombre.get(nombre) ?? (() => { throw error(`no existe el usuario "${nombre}"`); })();
  const admin = usuarios.find((u) => u.rol === 'administrador');
  const buscar = crearBuscadorDeRutas(usuarios, carpetas, archivos, 'Datos del historial incoherentes');
  const carpetaPorId = new Map(carpetas.map((c) => [c._id.toString(), c]));
  const actividades = [];
  const escrituras = { archivos: new Map(), carpetas: new Map(), usuarios: [] };
  const ajustes = []; // reescrituras del historial anterior a un cambio de nombre o de lugar

  const activoEn = (doc, fecha) => {
    const enviado = enviados.get(doc._id.toString());
    return fecha >= doc.creadoEn && (!enviado || fecha < enviado);
  };
  const marcar = (coleccion, doc) => escrituras[coleccion].set(doc._id.toString(), doc);
  const exigirDocumentoActivo = (doc, fecha, que) => {
    if (!activoEn(doc, fecha)) throw error(`${que} sobre "${doc.nombre}" cuando no existía o estaba en la papelera`);
  };

  // Cuentas inactivas: la desactivación definitiva y los intervalos de ADMINISTRACION.
  const inactivo = new Map(usuarios.map((u) => [u._id.toString(), u.desactivadoEn ? [[u.desactivadoEn, new Date(8.64e15)]] : []]));
  const estaInactivo = (u, fecha) => inactivo.get(u._id.toString()).some(([a, b]) => fecha >= a && fecha < b);

  // ---------------------------------------------------------------- ediciones
  const porArchivo = new Map();
  for (const e of EDICIONES) {
    const doc = buscar('archivo', e.de, e.archivo);
    porArchivo.set(doc._id.toString(), [...(porArchivo.get(doc._id.toString()) ?? []), { ...e, doc, fecha: fechaGt(e.fecha), por: usuario(e.por) }]);
  }
  for (const lista of porArchivo.values()) {
    lista.sort((a, b) => a.fecha - b.fecha);
    const doc = lista[0].doc;
    const original = ARCHIVOS.find((a) => a.usuario === lista[0].de && a.nombre === doc.nombre);
    if (original?.formato === 'latin1') throw error(`"${doc.nombre}" no está en UTF-8: no se puede editar en línea`);
    const n = lista.length;
    // Tamaños de las versiones anteriores (solo el contenido final existe en GridFS).
    const bytesVersion = (v) => Math.round(doc.contenido.bytes * (1 - 0.03 * (n + 1 - v)));
    lista.forEach((e, i) => {
      exigirDocumentoActivo(doc, e.fecha, 'una edición');
      if (nivelEn(e.por, doc, e.fecha) < NIVEL.edicion) throw error(`${e.por.nombreUsuario} no podía editar "${doc.nombre}" el ${e.fecha.toISOString()}`);
      actividades.push({
        accion: 'ARCHIVO_EDITADO',
        categoria: 'archivos',
        fecha: e.fecha,
        actor: actor(e.por),
        recurso: recurso('archivo', doc),
        detalles: { bytesAntes: bytesVersion(i + 1), bytesDespues: bytesVersion(i + 2), version: i + 2 },
        ip: IP,
      });
    });
    const ultima = lista.at(-1);
    doc.contenido = { ...doc.contenido, version: n + 1, actualizadoEn: ultima.fecha, actualizadoPor: ultima.por._id };
    doc.actualizadoEn = max(doc.actualizadoEn, ultima.fecha);
    marcar('archivos', doc);
  }

  // ---------------------------------------------------------------- clasificación
  for (const c of CLASIFICACIONES) {
    const doc = buscar('archivo', c.de, c.archivo);
    const fecha = fechaGt(c.fecha);
    exigirDocumentoActivo(doc, fecha, 'un cambio de clasificación');
    for (const [campo, { despues }] of Object.entries(c.cambios)) {
      if (JSON.stringify(doc[campo]) !== JSON.stringify(despues)) throw error(`la clasificación de "${doc.nombre}" no termina en su valor actual (${campo})`);
    }
    actividades.push({ accion: 'ARCHIVO_ACTUALIZADO', categoria: 'archivos', fecha, actor: actor(usuario(c.de)), recurso: recurso('archivo', doc), detalles: { cambios: c.cambios }, ip: IP });
    doc.actualizadoEn = max(doc.actualizadoEn, fecha);
    marcar('archivos', doc);
  }

  // ---------------------------------------------------------------- cambios de nombre
  for (const r of RENOMBRES) {
    const doc = buscar(r.tipo, r.de, r.ruta);
    const fecha = fechaGt(r.fecha);
    exigirDocumentoActivo(doc, fecha, 'un cambio de nombre');
    if (r.tipo === 'archivo' && separarExtension(r.nombreAnterior).extension !== doc.extension) {
      throw error(`"${r.nombreAnterior}" cambiaría la extensión de "${doc.nombre}"`);
    }
    actividades.push({
      accion: r.tipo === 'archivo' ? 'ARCHIVO_RENOMBRADO' : 'CARPETA_RENOMBRADA',
      categoria: r.tipo === 'archivo' ? 'archivos' : 'carpetas',
      fecha,
      actor: actor(usuario(r.de)),
      recurso: recurso(r.tipo, doc),
      detalles: { nombreAnterior: r.nombreAnterior, nombreNuevo: doc.nombre },
      ip: IP,
    });
    // Antes del cambio, el historial lo nombra (y lo ubica) con el nombre anterior.
    ajustes.push((a) => {
      if (a.fecha >= fecha) return;
      if (a.recurso?._id.equals(doc._id)) a.recurso = { ...a.recurso, nombre: r.nombreAnterior };
      for (const campo of ['carpeta', 'padre', 'ubicacion', 'origen', 'destino']) {
        if (a.detalles?.[campo]?._id?.equals?.(doc._id)) a.detalles = { ...a.detalles, [campo]: { _id: doc._id, nombre: r.nombreAnterior } };
      }
    });
    doc.actualizadoEn = max(doc.actualizadoEn, fecha);
    marcar(r.tipo === 'archivo' ? 'archivos' : 'carpetas', doc);
  }

  // ---------------------------------------------------------------- movimientos
  for (const m of MOVIMIENTOS) {
    const doc = buscar(m.tipo, m.de, m.ruta);
    const fecha = fechaGt(m.fecha);
    exigirDocumentoActivo(doc, fecha, 'un movimiento');
    const origen = m.desde ? buscar('carpeta', m.de, m.desde) : null;
    const destino = carpetaPorId.get(String(m.tipo === 'archivo' ? doc.carpetaId : doc.padreId)) ?? null;
    if (origen && (origen.creadoEn > doc.creadoEn || !activoEn(origen, fecha))) throw error(`"${m.desde}" no existía cuando "${doc.nombre}" estaba allí`);
    if ((origen?._id.toString() ?? null) === (destino?._id.toString() ?? null)) throw error(`"${doc.nombre}" no cambia de lugar`);
    if (m.tipo === 'carpeta' && origen?.ancestros.some((a) => a.equals(doc._id))) throw error(`"${doc.nombre}" estaría dentro de sí misma`);

    const detalles = { origen: lugar(origen), destino: lugar(destino) };
    if (m.tipo === 'carpeta') {
      detalles.elementosAfectados = {
        carpetas: carpetas.filter((c) => c.ancestros.some((a) => a.equals(doc._id))).length,
        archivos: archivos.filter((a) => a.ancestros.some((x) => x.equals(doc._id))).length,
      };
    }
    actividades.push({
      accion: m.tipo === 'archivo' ? 'ARCHIVO_MOVIDO' : 'CARPETA_MOVIDA',
      categoria: m.tipo === 'archivo' ? 'archivos' : 'carpetas',
      fecha,
      actor: actor(usuario(m.de)),
      recurso: recurso(m.tipo, doc),
      detalles,
      ip: IP,
    });
    // Antes del movimiento, se creó o se subió en la carpeta de origen.
    ajustes.push((a) => {
      if (a.fecha >= fecha || !a.recurso?._id.equals(doc._id)) return;
      if (a.accion === 'ARCHIVO_SUBIDO') a.detalles = { ...a.detalles, carpeta: lugar(origen) };
      if (a.accion === 'CARPETA_CREADA') a.detalles = { ...a.detalles, padre: lugar(origen) };
    });
    doc.actualizadoEn = max(doc.actualizadoEn, fecha);
    marcar(m.tipo === 'archivo' ? 'archivos' : 'carpetas', doc);
  }

  // ---------------------------------------------------------------- comentarios borrados
  for (const c of COMENTARIOS_BORRADOS) {
    const doc = buscar('archivo', c.de, c.archivo);
    const autor = usuario(c.autor);
    const borrador = usuario(c.borradoPor);
    const [escrito, borrado] = [fechaGt(c.escrito), fechaGt(c.borrado)];
    exigirDocumentoActivo(doc, borrado, 'un comentario');
    if (borrado <= escrito || nivelEn(autor, doc, escrito) < NIVEL.comentario) throw error(`${c.autor} no podía comentar "${doc.nombre}" el ${c.escrito}`);
    if (!borrador._id.equals(autor._id) && !borrador._id.equals(doc.propietarioId)) throw error(`${c.borradoPor} no puede borrar el comentario de ${c.autor}`);
    const comentarioId = new ObjectId();
    const base = { categoria: 'archivos', recurso: recurso('archivo', doc), ip: IP };
    actividades.push(
      { ...base, accion: 'ARCHIVO_CONSULTADO', fecha: new Date(escrito.getTime() - 2 * 60_000), actor: actor(autor) },
      { ...base, accion: 'COMENTARIO_AGREGADO', fecha: escrito, actor: actor(autor), detalles: { comentarioId, extracto: extracto(c.texto) } },
      {
        ...base,
        accion: 'COMENTARIO_ELIMINADO',
        fecha: borrado,
        actor: actor(borrador),
        ...(borrador._id.equals(autor._id) ? {} : { usuarioAfectado: resumen(autor) }),
        detalles: { comentarioId, autor: resumen(autor), extracto: extracto(c.texto) },
      },
    );
  }

  // ---------------------------------------------------------------- administración de cuentas
  const versionSesion = new Map();
  const sumarVersion = (u) => versionSesion.set(u._id.toString(), (versionSesion.get(u._id.toString()) ?? 0) + 1);
  const desactivaciones = new Map();
  for (const a of [...ADMINISTRACION].sort((x, y) => x.fecha.localeCompare(y.fecha))) {
    const afectado = usuario(a.usuario);
    const fecha = fechaGt(a.fecha);
    if (fecha < afectado.creadoEn) throw error(`${a.accion} sobre ${a.usuario} antes de crear su cuenta`);
    const entrada = { accion: a.accion, categoria: 'usuarios', fecha, actor: actor(admin), usuarioAfectado: resumen(afectado), ip: IP };
    if (a.accion === 'USUARIO_ACTUALIZADO') {
      const antes = a.cuotaMb.antes * MB;
      if (afectado.almacenamiento.cuotaBytes !== antes) throw error(`la cuota de ${a.usuario} no era de ${a.cuotaMb.antes} MB`);
      entrada.detalles = { cambios: { cuotaBytes: { antes, despues: a.cuotaMb.despues * MB } } };
      afectado.almacenamiento.cuotaBytes = a.cuotaMb.despues * MB;
      escrituras.usuarios.push({ updateOne: { filter: { _id: afectado._id }, update: { $set: { 'almacenamiento.cuotaBytes': a.cuotaMb.despues * MB } } } });
    }
    if (a.accion === 'USUARIO_CLAVE_RESTABLECIDA') sumarVersion(afectado);
    if (a.accion === 'USUARIO_DESACTIVADO') {
      desactivaciones.set(a.usuario, fecha);
      sumarVersion(afectado);
    }
    if (a.accion === 'USUARIO_ACTIVADO') {
      const desde = desactivaciones.get(a.usuario);
      if (!desde) throw error(`${a.usuario} se activa sin haberse desactivado`);
      inactivo.get(afectado._id.toString()).push([desde, fecha]);
      desactivaciones.delete(a.usuario);
    }
    actividades.push(entrada);
  }
  if (desactivaciones.size) throw error(`cuentas desactivadas que siguen activas en los datos: ${[...desactivaciones.keys()].join(', ')}`);

  // ---------------------------------------------------------------- sesiones
  for (const s of SESIONES_FALLIDAS) {
    const u = usuario(s.usuario);
    const fecha = fechaGt(s.fecha);
    const inactivoEnFecha = estaInactivo(u, fecha);
    if ((s.motivo === 'Usuario inactivo') !== inactivoEnFecha) throw error(`el motivo del intento de ${s.usuario} el ${s.fecha} no corresponde al estado de la cuenta`);
    actividades.push({ accion: 'INICIO_SESION_FALLIDO', categoria: 'autenticacion', fecha, actor: actor(u), detalles: { motivo: s.motivo }, ip: IP });
  }
  for (const c of CLAVES_CAMBIADAS) {
    const u = usuario(c.usuario);
    actividades.push({ accion: 'CLAVE_CAMBIADA', categoria: 'autenticacion', fecha: fechaGt(c.fecha), actor: actor(u), ip: IP });
    sumarVersion(u);
  }
  for (const [id, incremento] of versionSesion) {
    escrituras.usuarios.push({ updateOne: { filter: { _id: new ObjectId(id) }, update: { $inc: { versionSesion: incremento } } } });
  }

  // ---------------------------------------------------------------- uso cotidiano (lecturas y descargas)
  const azar = generador(USO.semilla);
  const fin = fechaGt(`${USO.ultimoDia}T18:00`);
  const personas = usuarios.filter((u) => u.rol !== 'administrador');
  /** Un instante al azar en horario de oficina de un día hábil (hora de Guatemala), dentro de [desde, hasta]. */
  const momento = (desde, hasta) => {
    for (let intento = 0; intento < 12; intento++) {
      const base = new Date(desde.getTime() + azar() * (hasta.getTime() - desde.getTime()));
      const local = new Date(base.getTime() - 6 * 3600_000);
      const diaSemana = local.getUTCDay();
      if (diaSemana === 0 || diaSemana === 6) continue;
      const minutos = 8 * 60 + Math.floor(azar() * (9.5 * 60));
      const fecha = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, minutos) + 6 * 3600_000);
      if (fecha > desde && fecha < hasta) return fecha;
    }
    return null;
  };
  const usar = (u, doc, fecha) => {
    actividades.push({ accion: 'ARCHIVO_CONSULTADO', categoria: 'archivos', fecha, actor: actor(u), recurso: recurso('archivo', doc), ip: IP });
    if (azar() < USO.probabilidadDescarga) {
      actividades.push({ accion: 'ARCHIVO_DESCARGADO', categoria: 'archivos', fecha: new Date(fecha.getTime() + 2 * 60_000), actor: actor(u), recurso: recurso('archivo', doc), ip: IP });
    }
  };
  for (const doc of [...archivos].sort((a, b) => a.creadoEn - b.creadoEn)) {
    const desde = new Date(doc.creadoEn.getTime() + 3600_000);
    const hasta = enviados.get(doc._id.toString()) ?? fin;
    if (hasta <= desde) continue;
    const dueno = usuarios.find((u) => u._id.equals(doc.propietarioId));
    const veces = USO.consultasDueno.min + Math.floor(azar() * (USO.consultasDueno.max - USO.consultasDueno.min + 1));
    for (let i = 0; i < veces; i++) {
      const fecha = momento(desde, hasta);
      if (fecha && !estaInactivo(dueno, fecha)) usar(dueno, doc, fecha);
    }
    for (const u of personas.filter((p) => !p._id.equals(doc.propietarioId))) {
      if (azar() >= USO.probabilidadConsultaCompartida) continue;
      for (let intento = 0; intento < 4; intento++) {
        const fecha = momento(desde, hasta);
        if (fecha && !estaInactivo(u, fecha) && fecha >= u.creadoEn && nivelEn(u, doc, fecha) >= NIVEL.lectura) {
          usar(u, doc, fecha);
          break;
        }
      }
    }
  }

  return {
    actividades,
    escrituras: {
      archivos: [...escrituras.archivos.values()].map((d) => ({
        updateOne: { filter: { _id: d._id }, update: { $set: { contenido: d.contenido, actualizadoEn: d.actualizadoEn } } },
      })),
      carpetas: [...escrituras.carpetas.values()].map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: { actualizadoEn: d.actualizadoEn } } } })),
      usuarios: escrituras.usuarios,
    },
    /** Reescribe el historial anterior a cada cambio de nombre o de lugar. */
    ajustarHistorial(todas) {
      for (const a of todas) for (const ajuste of ajustes) ajuste(a);
    },
    /** Nadie actúa antes de que exista su cuenta ni mientras está desactivada (salvo intentar entrar). */
    validarActores(todas) {
      const porId = new Map(usuarios.map((u) => [u._id.toString(), u]));
      for (const a of todas) {
        const u = porId.get(a.actor._id.toString());
        if (!u) throw error(`${a.accion} de un usuario inexistente`);
        if (a.fecha < u.creadoEn) throw error(`${u.nombreUsuario} tiene ${a.accion} antes de que existiera su cuenta`);
        if (a.fecha > fin) throw error(`${a.accion} de ${u.nombreUsuario} en el futuro (${a.fecha.toISOString()})`);
        if (a.accion !== 'INICIO_SESION_FALLIDO' && estaInactivo(u, a.fecha)) {
          throw error(`${u.nombreUsuario} tiene ${a.accion} el ${a.fecha.toISOString()} con la cuenta desactivada`);
        }
      }
    },
    /** Cierres de sesión al final de algunos días con actividad. */
    cierresDeSesion(todas) {
      const ultimaDelDia = new Map();
      for (const a of todas) {
        if (['INICIO_SESION_FALLIDO', 'INICIO_SESION'].includes(a.accion)) continue;
        const dia = new Date(a.fecha.getTime() - 6 * 3600_000).toISOString().slice(0, 10);
        const clave = `${a.actor._id}|${dia}`;
        const actual = ultimaDelDia.get(clave);
        if (!actual || a.fecha > actual.fecha) ultimaDelDia.set(clave, a);
      }
      return [...ultimaDelDia.entries()]
        .sort(([x], [y]) => x.localeCompare(y))
        .filter(() => azar() < USO.probabilidadCierre)
        .map(([, a]) => ({
          accion: 'CIERRE_SESION',
          categoria: 'autenticacion',
          fecha: new Date(a.fecha.getTime() + (5 + Math.floor(azar() * 35)) * 60_000),
          actor: a.actor,
          ip: IP,
        }))
        .filter((c) => c.fecha <= fin);
    },
  };
}
