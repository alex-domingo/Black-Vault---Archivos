import { NivelAcceso, NOMBRE_NIVEL, ResumenUsuario } from './documentos';
import { TipoRecurso } from './comparticiones';

export type CategoriaActividad = 'autenticacion' | 'usuarios' | 'carpetas' | 'archivos' | 'papelera' | 'comparticiones';

export interface Actividad {
  _id: string;
  accion: string;
  categoria: CategoriaActividad;
  fecha: string;
  actor: ResumenUsuario & { rol: string };
  recurso?: { tipo: TipoRecurso; _id: string; nombre: string; propietarioId: string };
  usuarioAfectado?: ResumenUsuario;
  detalles?: Record<string, unknown>;
  /** Solo para el administrador. */
  ip?: string;
}

export type AlcanceActividad = 'todo' | 'mias' | 'mis-recursos' | 'conmigo';

export interface FiltroActividad {
  alcance?: AlcanceActividad;
  categoria?: CategoriaActividad;
  accion?: string;
  desde?: string;
  hasta?: string;
  usuarioId?: string;
  pagina: number;
  limite: number;
}

export const CATEGORIAS_ACTIVIDAD: { valor: CategoriaActividad; etiqueta: string; icono: string }[] = [
  { valor: 'archivos', etiqueta: 'Archivos', icono: 'description' },
  { valor: 'carpetas', etiqueta: 'Carpetas', icono: 'folder' },
  { valor: 'comparticiones', etiqueta: 'Compartir', icono: 'share' },
  { valor: 'papelera', etiqueta: 'Papelera', icono: 'delete' },
  { valor: 'autenticacion', etiqueta: 'Sesiones', icono: 'login' },
  { valor: 'usuarios', etiqueta: 'Usuarios', icono: 'manage_accounts' },
];

/** Catálogo de acciones (diseño, sección 6), con su nombre legible. */
export const ACCIONES: { valor: string; etiqueta: string; categoria: CategoriaActividad }[] = [
  { valor: 'INICIO_SESION', etiqueta: 'Inicio de sesión', categoria: 'autenticacion' },
  { valor: 'INICIO_SESION_FALLIDO', etiqueta: 'Inicio de sesión fallido', categoria: 'autenticacion' },
  { valor: 'CIERRE_SESION', etiqueta: 'Cierre de sesión', categoria: 'autenticacion' },
  { valor: 'CLAVE_CAMBIADA', etiqueta: 'Cambio de contraseña', categoria: 'autenticacion' },
  { valor: 'USUARIO_CREADO', etiqueta: 'Usuario creado', categoria: 'usuarios' },
  { valor: 'USUARIO_ACTUALIZADO', etiqueta: 'Usuario actualizado', categoria: 'usuarios' },
  { valor: 'USUARIO_ACTIVADO', etiqueta: 'Usuario activado', categoria: 'usuarios' },
  { valor: 'USUARIO_DESACTIVADO', etiqueta: 'Usuario desactivado', categoria: 'usuarios' },
  { valor: 'USUARIO_CLAVE_RESTABLECIDA', etiqueta: 'Contraseña restablecida', categoria: 'usuarios' },
  { valor: 'CARPETA_CREADA', etiqueta: 'Carpeta creada', categoria: 'carpetas' },
  { valor: 'CARPETA_RENOMBRADA', etiqueta: 'Carpeta renombrada', categoria: 'carpetas' },
  { valor: 'CARPETA_MOVIDA', etiqueta: 'Carpeta movida', categoria: 'carpetas' },
  { valor: 'ARCHIVO_SUBIDO', etiqueta: 'Archivo subido', categoria: 'archivos' },
  { valor: 'ARCHIVO_CONSULTADO', etiqueta: 'Archivo consultado', categoria: 'archivos' },
  { valor: 'ARCHIVO_DESCARGADO', etiqueta: 'Archivo descargado', categoria: 'archivos' },
  { valor: 'ARCHIVO_EDITADO', etiqueta: 'Archivo editado', categoria: 'archivos' },
  { valor: 'ARCHIVO_RENOMBRADO', etiqueta: 'Archivo renombrado', categoria: 'archivos' },
  { valor: 'ARCHIVO_ACTUALIZADO', etiqueta: 'Clasificación cambiada', categoria: 'archivos' },
  { valor: 'ARCHIVO_MOVIDO', etiqueta: 'Archivo movido', categoria: 'archivos' },
  { valor: 'COMENTARIO_AGREGADO', etiqueta: 'Comentario agregado', categoria: 'archivos' },
  { valor: 'COMENTARIO_ELIMINADO', etiqueta: 'Comentario eliminado', categoria: 'archivos' },
  { valor: 'ARCHIVO_ENVIADO_PAPELERA', etiqueta: 'Archivo a la papelera', categoria: 'papelera' },
  { valor: 'CARPETA_ENVIADA_PAPELERA', etiqueta: 'Carpeta a la papelera', categoria: 'papelera' },
  { valor: 'ARCHIVO_RESTAURADO', etiqueta: 'Archivo restaurado', categoria: 'papelera' },
  { valor: 'CARPETA_RESTAURADA', etiqueta: 'Carpeta restaurada', categoria: 'papelera' },
  { valor: 'ARCHIVO_ELIMINADO_DEFINITIVO', etiqueta: 'Archivo eliminado definitivamente', categoria: 'papelera' },
  { valor: 'CARPETA_ELIMINADA_DEFINITIVO', etiqueta: 'Carpeta eliminada definitivamente', categoria: 'papelera' },
  { valor: 'PAPELERA_VACIADA', etiqueta: 'Papelera vaciada', categoria: 'papelera' },
  { valor: 'COMPARTICION_CREADA', etiqueta: 'Compartido', categoria: 'comparticiones' },
  { valor: 'COMPARTICION_MODIFICADA', etiqueta: 'Permiso cambiado', categoria: 'comparticiones' },
  { valor: 'COMPARTICION_RETIRADA', etiqueta: 'Acceso retirado', categoria: 'comparticiones' },
];

/** Fragmento de una descripción: el texto resaltado (personas, recursos) va en negrita. */
export interface Fragmento {
  texto: string;
  resaltado?: boolean;
}

const nombreDe = (u: ResumenUsuario | undefined, yo: string | null) => (u ? (u._id === yo ? 'Tú' : u.nombreCompleto) : 'Alguien');
const permiso = (valor: unknown) => (NOMBRE_NIVEL[valor as NivelAcceso] ?? String(valor ?? '')).toLowerCase();
const lugar = (valor: unknown) => ((valor as { nombre?: string } | null)?.nombre ?? 'Mi unidad');
const bytes = (valor: unknown) => {
  const n = Number(valor ?? 0);
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
};
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Frase en español que describe una actividad, desde el punto de vista de quien la lee:
 * "Tú compartiste «Plan.md» con José Antonio Ramírez (comentar)".
 */
export function describirActividad(a: Actividad, yo: string | null): Fragmento[] {
  const d = a.detalles ?? {};
  const quien: Fragmento = { texto: nombreDe(a.actor, yo), resaltado: true };
  const tu = quien.texto === 'Tú';
  // Conjuga en segunda persona cuando el actor es quien lee.
  const v = (tercera: string, segunda: string) => (tu ? segunda : tercera);
  const r: Fragmento = { texto: `«${a.recurso?.nombre ?? '?'}»`, resaltado: true };
  const otro: Fragmento = { texto: a.usuarioAfectado?.nombreCompleto ?? 'alguien', resaltado: true };
  // Cuando la persona afectada es quien lee: "tu cuenta", "contigo", "te quitó el acceso".
  const aMi = !!a.usuarioAfectado && a.usuarioAfectado._id === yo;
  const sobre = (de: string, mio: string): Fragmento[] => (aMi ? [t(mio)] : [t(de), otro]);
  const t = (texto: string): Fragmento => ({ texto });

  switch (a.accion) {
    case 'INICIO_SESION':
      return [quien, t(v(' inició sesión', ' iniciaste sesión'))];
    case 'INICIO_SESION_FALLIDO':
      return [t('Intento fallido de iniciar sesión como '), { texto: a.actor.nombreCompleto, resaltado: true }, t(d['motivo'] ? ` (${String(d['motivo']).toLowerCase()})` : '')];
    case 'CIERRE_SESION':
      return [quien, t(v(' cerró sesión', ' cerraste sesión'))];
    case 'CLAVE_CAMBIADA':
      return [quien, t(v(' cambió su contraseña', ' cambiaste tu contraseña'))];
    case 'USUARIO_CREADO':
      return [quien, t(v(' creó', ' creaste')), ...sobre(' la cuenta de ', ' tu cuenta')];
    case 'USUARIO_ACTUALIZADO':
      return [quien, t(v(' actualizó', ' actualizaste')), ...sobre(' los datos de ', ' tus datos')];
    case 'USUARIO_ACTIVADO':
      return [quien, t(v(' activó', ' activaste')), ...sobre(' la cuenta de ', ' tu cuenta')];
    case 'USUARIO_DESACTIVADO':
      return [quien, t(v(' desactivó', ' desactivaste')), ...sobre(' la cuenta de ', ' tu cuenta')];
    case 'USUARIO_CLAVE_RESTABLECIDA':
      return [quien, t(v(' restableció', ' restableciste')), ...sobre(' la contraseña de ', ' tu contraseña')];
    case 'CARPETA_CREADA':
      return [quien, t(v(' creó la carpeta ', ' creaste la carpeta ')), r, t(` en ${lugar(d['padre'])}`)];
    case 'CARPETA_RENOMBRADA':
      return [quien, t(v(' cambió el nombre de la carpeta ', ' cambiaste el nombre de la carpeta ')), { texto: `«${d['nombreAnterior']}»`, resaltado: true }, t(' a '), { texto: `«${d['nombreNuevo']}»`, resaltado: true }];
    case 'CARPETA_MOVIDA':
      return [quien, t(v(' movió la carpeta ', ' moviste la carpeta ')), r, t(` a ${lugar(d['destino'])}`)];
    case 'ARCHIVO_SUBIDO':
      return [quien, t(v(' subió ', ' subiste ')), r, t(` a ${lugar(d['carpeta'])}`)];
    case 'ARCHIVO_CONSULTADO':
      return [quien, t(v(' abrió ', ' abriste ')), r];
    case 'ARCHIVO_DESCARGADO':
      return [quien, t(v(' descargó ', ' descargaste ')), r];
    case 'ARCHIVO_EDITADO':
      return [quien, t(v(' editó ', ' editaste ')), r, t(d['version'] ? ` (versión ${d['version']})` : '')];
    case 'ARCHIVO_RENOMBRADO':
      return [quien, t(v(' cambió el nombre de ', ' cambiaste el nombre de ')), { texto: `«${d['nombreAnterior']}»`, resaltado: true }, t(' a '), { texto: `«${d['nombreNuevo']}»`, resaltado: true }];
    case 'ARCHIVO_ACTUALIZADO':
      return [quien, t(v(' cambió la clasificación de ', ' cambiaste la clasificación de ')), r];
    case 'ARCHIVO_MOVIDO':
      return [quien, t(v(' movió ', ' moviste ')), r, t(` a ${lugar(d['destino'])}`)];
    case 'COMENTARIO_AGREGADO':
      return [quien, t(v(' comentó en ', ' comentaste en ')), r, t(d['extracto'] ? `: “${d['extracto']}”` : '')];
    case 'COMENTARIO_ELIMINADO':
      return [quien, t(v(' eliminó un comentario de ', ' eliminaste un comentario de ')), r];
    case 'ARCHIVO_ENVIADO_PAPELERA':
      return [quien, t(v(' envió ', ' enviaste ')), r, t(' a la papelera')];
    case 'CARPETA_ENVIADA_PAPELERA': {
      const e = (d['elementos'] ?? {}) as { carpetas?: number; archivos?: number };
      return [quien, t(v(' envió la carpeta ', ' enviaste la carpeta ')), r, t(` a la papelera, con ${plural(e.archivos ?? 0, 'archivo', 'archivos')}`)];
    }
    case 'ARCHIVO_RESTAURADO':
    case 'CARPETA_RESTAURADA': {
      const renombrado = d['nombreAnterior'] ? ` (antes «${d['nombreAnterior']}»)` : '';
      return [quien, t(v(' restauró ', ' restauraste ')), r, t(`${renombrado} en ${lugar(d['destino'])}`)];
    }
    case 'ARCHIVO_ELIMINADO_DEFINITIVO':
      return [quien, t(v(' eliminó definitivamente ', ' eliminaste definitivamente ')), r, t(`${v(' y liberó ', ' y liberaste ')}${bytes(d['bytes'])}`)];
    case 'CARPETA_ELIMINADA_DEFINITIVO':
      return [quien, t(v(' eliminó definitivamente la carpeta ', ' eliminaste definitivamente la carpeta ')), r, t(` (${plural(Number(d['archivos'] ?? 0), 'archivo', 'archivos')}, ${bytes(d['bytes'])})`)];
    case 'PAPELERA_VACIADA':
      return [quien, t(v(' vació su papelera', ' vaciaste tu papelera')), t(` (${plural(Number(d['archivos'] ?? 0), 'archivo', 'archivos')}, ${bytes(d['bytes'])} liberados)`)];
    case 'COMPARTICION_CREADA':
      return [quien, t(v(' compartió ', ' compartiste ')), r, ...sobre(' con ', ' contigo'), t(` (${permiso(d['permiso'])})`)];
    case 'COMPARTICION_MODIFICADA':
      return [quien, t(v(' cambió', ' cambiaste')), ...sobre(' el permiso de ', ' tu permiso'), t(' sobre '), r, t(` de ${permiso(d['permisoAnterior'])} a ${permiso(d['permisoNuevo'])}`)];
    case 'COMPARTICION_RETIRADA':
      return aMi
        ? [quien, t(' te quitó el acceso a '), r]
        : [quien, t(v(' quitó el acceso de ', ' quitaste el acceso de ')), otro, t(' a '), r];
    default:
      return [quien, t(` · ${a.accion}`), ...(a.recurso ? [t(' · '), r] : [])];
  }
}
