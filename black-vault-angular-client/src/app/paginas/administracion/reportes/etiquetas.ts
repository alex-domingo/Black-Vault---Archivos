import { ACCIONES, CATEGORIAS_ACTIVIDAD } from '../../../nucleo/modelos/actividad';
import { PERMISOS } from '../../../nucleo/modelos/comparticiones';
import { CATEGORIAS } from '../../../nucleo/modelos/documentos';
import { EstadoRecurso } from '../../../nucleo/modelos/reportes';

export const nombreAccion = (valor: string) => ACCIONES.find((a) => a.valor === valor)?.etiqueta ?? valor;
export const nombreCategoriaActividad = (valor: string) => CATEGORIAS_ACTIVIDAD.find((c) => c.valor === valor)?.etiqueta ?? valor;
export const nombreCategoria = (valor: string) => CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor;
export const nombrePermiso = (valor: string) => PERMISOS.find((p) => p.valor === valor)?.etiqueta ?? valor;
export const nombreTipo = (extension: string | undefined) => (extension === 'md' ? 'Markdown (.md)' : extension === 'txt' ? 'Texto (.txt)' : '—');
export const nombreEstado: Record<EstadoRecurso, string> = { activo: 'Activo', papelera: 'En la papelera', eliminado: 'Eliminado' };

const numero = new Intl.NumberFormat('es-GT');
export const formatoNumero = (n: number) => numero.format(n);

/** Bytes legibles (igual que el pipe "bytes", para gráficas y CSV). */
export function formatoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const fechaHora = new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'short', timeStyle: 'short' });
export const formatoFechaHora = (iso: string | undefined) => (iso ? fechaHora.format(new Date(iso)) : '');
