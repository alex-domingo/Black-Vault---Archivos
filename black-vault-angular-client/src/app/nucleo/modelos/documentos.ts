/** Nivel de acceso efectivo sobre un recurso (propio o compartido). */
export type NivelAcceso = 'propietario' | 'edicion' | 'comentario' | 'lectura';

export const NIVEL_NUMERICO: Record<NivelAcceso, number> = { lectura: 1, comentario: 2, edicion: 3, propietario: 4 };

export const NOMBRE_NIVEL: Record<NivelAcceso, string> = {
  propietario: 'Propietario',
  edicion: 'Edición',
  comentario: 'Comentar',
  lectura: 'Lectura',
};

export type Categoria = 'administrativo' | 'informe' | 'contrato' | 'otro';

export const CATEGORIAS: { valor: Categoria; etiqueta: string }[] = [
  { valor: 'administrativo', etiqueta: 'Administrativo' },
  { valor: 'informe', etiqueta: 'Informe' },
  { valor: 'contrato', etiqueta: 'Contrato' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export type Extension = 'txt' | 'md';

export interface ResumenUsuario {
  _id: string;
  nombreUsuario: string;
  nombreCompleto: string;
}

export interface ElementoRuta {
  _id: string;
  nombre: string;
}

export interface Carpeta {
  _id: string;
  tipo: 'carpeta';
  nombre: string;
  padreId: string | null;
  propietarioId: string;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface Archivo {
  _id: string;
  tipo: 'archivo';
  nombre: string;
  extension: Extension;
  tipoMime: string;
  categoria: Categoria;
  etiquetas: string[];
  descripcion: string;
  bytes: number;
  version: number;
  sha256: string;
  carpetaId: string | null;
  propietarioId: string;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
  contenidoActualizadoEn: string;
  contenidoActualizadoPor: string;
}

export type Elemento = Carpeta | Archivo;

/** Respuesta de GET /carpetas/raiz/contenido y /carpetas/:id/contenido. */
export interface ContenidoCarpeta {
  carpeta: (Carpeta & { propietario: ResumenUsuario | null }) | null;
  ruta: ElementoRuta[];
  acceso: NivelAcceso;
  carpetas: Carpeta[];
  archivos: Archivo[];
}

export interface DetalleCarpeta extends Carpeta {
  propietario: ResumenUsuario | null;
  creador: ResumenUsuario | null;
  ruta: ElementoRuta[];
  acceso: NivelAcceso;
  elementos: { carpetas: number; archivos: number };
}

export interface DetalleArchivo extends Archivo {
  propietario: ResumenUsuario | null;
  creador: ResumenUsuario | null;
  editorContenido: ResumenUsuario | null;
  ruta: ElementoRuta[];
  acceso: NivelAcceso;
}

/** Respuesta de GET /archivos/:id/contenido. */
export interface TextoArchivo {
  contenido: string;
  esUtf8: boolean;
  tieneBom: boolean;
  saltosDeLinea: 'crlf' | 'lf';
  version: number;
  sha256: string;
  bytes: number;
  acceso: NivelAcceso;
}

export interface ResultadoBusqueda extends Archivo {
  propietario: ResumenUsuario | null;
  carpeta: { _id: string; nombre: string } | null;
  esPropio: boolean;
}

export interface FiltroBusqueda {
  buscar?: string;
  texto?: string;
  tipo?: Extension;
  categoria?: Categoria;
  etiqueta?: string;
  desde?: string;
  hasta?: string;
  alcance: 'propios' | 'compartidos' | 'todos';
  orden: 'nombre' | 'fecha' | 'tamano' | 'tipo' | 'relevancia';
  direccion: 'asc' | 'desc';
  pagina: number;
  limite: number;
}

export interface NodoCarpeta {
  _id: string;
  nombre: string;
  padreId: string | null;
  ancestros: string[];
}

export interface EstadoAlmacenamiento {
  usadoBytes: number;
  cuotaBytes: number;
  porTipo: { extension: Extension; archivos: number; bytes: number }[];
  enPapelera: { archivos: number; bytes: number };
}

export type OrdenContenido = 'nombre' | 'fecha' | 'tamano' | 'tipo';

/** ¿El nivel alcanza el mínimo pedido? */
export function tieneNivel(nivel: NivelAcceso | null | undefined, minimo: NivelAcceso): boolean {
  return !!nivel && NIVEL_NUMERICO[nivel] >= NIVEL_NUMERICO[minimo];
}
