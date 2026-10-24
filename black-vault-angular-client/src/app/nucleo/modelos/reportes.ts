import { Actividad, CategoriaActividad } from './actividad';
import { Permiso, TipoRecurso } from './comparticiones';
import { Categoria, Extension } from './documentos';
import { Paginado } from './usuario';

/** Usuario tal como lo devuelven los reportes. */
export interface UsuarioReporte {
  _id: string;
  nombreUsuario: string;
  nombreCompleto: string;
  activo: boolean;
  rol: string;
}

export interface RangoFechas {
  desde?: string;
  hasta?: string;
}

/** Punto de una serie temporal (período alineado en hora de Guatemala). */
export interface PuntoSerie {
  periodo: string;
  cantidad: number;
}

export interface Resumen {
  usuarios: { total: number; activos: number; inactivos: number; administradores: number; usadoBytes: number; cuotaBytes: number };
  archivos: { activos: number; enPapelera: number; bytes: number; bytesPapelera: number; comentarios: number };
  carpetas: { activas: number; enPapelera: number };
  comparticiones: { total: number; archivos: number; carpetas: number };
  actividad: { total: number; ultimos30Total: number; ultimos30Dias: PuntoSerie[] };
}

/** RR-01 */
export interface ArchivosPorTipo {
  porTipo: { tipo: Extension; cantidad: number; bytes: number; promedioBytes: number; enPapelera: number; ultimaCarga: string }[];
  porCategoria: { categoria: Categoria; cantidad: number; bytes: number }[];
  total: { cantidad: number; bytes: number };
}

/** RR-02 */
export interface ArchivoEnRango {
  _id: string;
  nombre: string;
  extension: Extension;
  categoria: Categoria;
  etiquetas: string[];
  creadoEn: string;
  enPapelera: boolean;
  bytes: number;
  propietario: UsuarioReporte | null;
  carpeta: string | null;
}
export interface ArchivosPorFecha extends Paginado<ArchivoEnRango> {
  bytes: number;
  /** El servidor agrupa la serie según el largo del rango (máximo ~60 columnas). */
  unidadSerie: UnidadPeriodo;
  serie: PuntoSerie[];
}

export type EstadoRecurso = 'activo' | 'papelera' | 'eliminado';

/** RR-03 */
export interface ArchivoConOperaciones {
  _id: string;
  nombre: string;
  extension?: Extension;
  estado: EstadoRecurso;
  operaciones: number;
  porAccion: { accion: string; cantidad: number }[];
  ultima: string;
  propietario: UsuarioReporte | null;
}

/** RR-04 */
export interface UsuarioConArchivos {
  usuario: UsuarioReporte | null;
  activos: number;
  enPapelera: number;
  bytes: number;
  md: number;
  txt: number;
}

/** RR-05 */
export interface UsuarioQueComparte {
  usuario: UsuarioReporte | null;
  recursos: number;
  comparticiones: number;
  destinatarios: number;
  archivos: number;
  carpetas: number;
  lectura: number;
  comentario: number;
  edicion: number;
}

/** RR-06 */
export interface ArchivoCompartido {
  _id: string;
  nombre: string;
  extension: Extension;
  usuariosDirectos: number;
  usuariosEfectivos: number;
  heredados: number;
  propietario: UsuarioReporte | null;
  carpeta: string | null;
}

/** RR-07 y RR-08 */
export interface ComparticionReporte {
  _id: string;
  tipoRecurso: TipoRecurso;
  permiso: Permiso;
  creadoEn: string;
  actualizadoEn: string;
  estado: EstadoRecurso;
  recurso: { _id?: string; nombre?: string; extension?: Extension };
  destinatario?: UsuarioReporte | null;
  propietario?: UsuarioReporte | null;
}
export interface ComparticionesDeUsuario extends Paginado<ComparticionReporte> {
  usuario: UsuarioReporte;
  porPermiso: { permiso: Permiso; cantidad: number }[];
  personas: number;
}

/** RR-09 */
export interface ActividadDeUsuario extends Paginado<Actividad> {
  usuario: UsuarioReporte;
  porCategoria: { categoria: CategoriaActividad; cantidad: number }[];
}

/** RR-10 */
export interface OperacionesPorTipo {
  total: number;
  categorias: { categoria: CategoriaActividad; total: number; acciones: { accion: string; cantidad: number }[] }[];
}

export type UnidadPeriodo = 'dia' | 'semana' | 'mes';

/** RR-11 */
export interface OperacionesPorPeriodo {
  unidad: UnidadPeriodo;
  desde: string;
  hasta: string;
  total: number;
  serie: (PuntoSerie & { porCategoria: { categoria: CategoriaActividad; cantidad: number }[] })[];
}

/** RR-12 */
export interface AccionPrincipal {
  accion: string;
  categoria: CategoriaActividad;
  cantidad: number;
  porcentaje: number;
  usuariosDistintos: number;
  usuarioPrincipal: { _id: string; nombreUsuario: string; nombreCompleto: string; cantidad: number };
  ultima: string;
}
