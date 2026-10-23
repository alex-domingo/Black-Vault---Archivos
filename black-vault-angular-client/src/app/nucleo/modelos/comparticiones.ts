import { Archivo, Carpeta, ResumenUsuario } from './documentos';

/** Niveles que se pueden conceder al compartir (el de propietario no se comparte). */
export type Permiso = 'lectura' | 'comentario' | 'edicion';

export const PERMISOS: { valor: Permiso; etiqueta: string; descripcion: string }[] = [
  { valor: 'lectura', etiqueta: 'Lectura', descripcion: 'Ver y descargar' },
  { valor: 'comentario', etiqueta: 'Comentar', descripcion: 'Ver, descargar y comentar' },
  { valor: 'edicion', etiqueta: 'Edición', descripcion: 'Además, editar, renombrar y subir archivos' },
];

export type TipoRecurso = 'archivo' | 'carpeta';

export interface Destinatario extends ResumenUsuario {
  correo: string;
  activo: boolean;
}

export interface Comparticion {
  _id: string;
  tipoRecurso: TipoRecurso;
  recursoId: string;
  permiso: Permiso;
  destinatario: Destinatario | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ComparticionHeredada extends Comparticion {
  /** Carpeta de la que viene el acceso. */
  desde: { _id: string; nombre: string };
}

/** Respuesta de GET /comparticiones/recurso/:tipo/:id. */
export interface AccesoRecurso {
  recurso: { tipo: TipoRecurso; _id: string; nombre: string };
  directas: Comparticion[];
  heredadas: ComparticionHeredada[];
}

/** Elemento de "Compartidos conmigo". */
export interface CompartidoConmigo {
  _id: string;
  tipoRecurso: TipoRecurso;
  permiso: Permiso;
  compartidoEn: string;
  actualizadoEn: string;
  recurso: Carpeta | Archivo;
  propietario: ResumenUsuario | null;
}

/** Elemento de "Compartidos por mí": un recurso con las personas que tienen acceso directo. */
export interface CompartidoPorMi {
  tipoRecurso: TipoRecurso;
  recurso: Carpeta | Archivo;
  ultimoCambio: string;
  comparticiones: Comparticion[];
}

export interface FiltroCompartidos {
  tipo?: TipoRecurso;
  buscar?: string;
  pagina: number;
  limite: number;
}

export interface Comentario {
  _id: string;
  autor: ResumenUsuario;
  texto: string;
  creadoEn: string;
  puedeEliminar: boolean;
}

/** Respuesta de GET /archivos/:id/comentarios. */
export interface ComentariosArchivo {
  comentarios: Comentario[];
  puedeComentar: boolean;
  limite: number;
}
