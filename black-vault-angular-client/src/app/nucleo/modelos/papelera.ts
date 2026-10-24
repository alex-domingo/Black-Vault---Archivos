import { Archivo, Carpeta } from './documentos';
import { TipoRecurso } from './comparticiones';

/** Lo que se envió a la papelera (solo las raíces: lo que el usuario eliminó). */
export interface ElementoPapelera {
  tipo: TipoRecurso;
  recurso: Carpeta | Archivo;
  enviadoEn: string;
  /** Nombres de las carpetas donde estaba, desde la raíz. */
  ubicacionOriginal: string[];
  /** Su carpeta ya no está disponible: al restaurar vuelve a "Mi unidad". */
  restauraEnRaiz: boolean;
  /** Todo lo que se fue con él (incluido él mismo, si es un archivo). */
  contenido: { archivos: number; carpetas: number; bytes: number };
}

export interface FiltroPapelera {
  tipo?: TipoRecurso;
  buscar?: string;
  pagina: number;
  limite: number;
}

export interface ResultadoEnvio {
  tipo: TipoRecurso;
  _id: string;
  nombre: string;
  elementos: { carpetas: number; archivos: number };
}

export interface ResultadoRestauracion {
  tipo: TipoRecurso;
  _id: string;
  nombre: string;
  nombreAnterior: string;
  destino: { _id: string; nombre: string } | null;
  alOrigen: boolean;
  elementos: { carpetas: number; archivos: number };
}

export interface ResultadoEliminacion {
  carpetas: number;
  archivos: number;
  bytes: number;
}
