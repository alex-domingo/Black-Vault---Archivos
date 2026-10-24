import { UnidadPeriodo } from '../../../nucleo/modelos/reportes';

const ZONA = 'America/Guatemala';
const formato = (opciones: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-GT', { timeZone: ZONA, ...opciones });
const diaMes = formato({ day: 'numeric', month: 'short' });
const diaMesAnio = formato({ day: 'numeric', month: 'short', year: 'numeric' });
const mes = formato({ month: 'short' });
const mesAnio = formato({ month: 'long', year: 'numeric' });

/** Fecha del calendario (local) → 'AAAA-MM-DD'. */
export function aDia(fecha: Date | null | undefined): string | undefined {
  if (!fecha) return undefined;
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** 'AAAA-MM-DD' → fecha local (para el datepicker). */
export function deDia(dia: string | undefined): Date | null {
  if (!dia) return null;
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Etiquetas de un período de la serie (completa para el tooltip y corta para el eje). */
export function etiquetasPeriodo(periodo: string, unidad: UnidadPeriodo): { etiqueta: string; corta: string } {
  const fecha = new Date(periodo);
  if (unidad === 'mes') return { etiqueta: mesAnio.format(fecha), corta: mes.format(fecha) };
  if (unidad === 'semana') return { etiqueta: `Semana del ${diaMesAnio.format(fecha)}`, corta: diaMes.format(fecha) };
  return { etiqueta: diaMesAnio.format(fecha), corta: diaMes.format(fecha) };
}
