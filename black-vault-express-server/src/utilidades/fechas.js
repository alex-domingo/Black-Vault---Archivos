// Fechas de filtro (AAAA-MM-DD) interpretadas en la zona horaria del sistema (America/Guatemala).
import { z } from 'zod';
import { entorno } from '../config/entorno.js';

export const esquemaDia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.')
  .refine((texto) => !Number.isNaN(Date.parse(`${texto}T00:00:00Z`)), 'La fecha no es válida.');

/** Diferencia en minutos entre la zona horaria y UTC en un instante dado (Guatemala: -360). */
function desfaseMinutos(zona, instante) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'longOffset' })
    .formatToParts(instante)
    .find((p) => p.type === 'timeZoneName')?.value; // "GMT-06:00" o "GMT"
  const coincidencia = /GMT([+-])(\d{2}):(\d{2})/.exec(partes ?? '');
  if (!coincidencia) return 0;
  const minutos = Number(coincidencia[2]) * 60 + Number(coincidencia[3]);
  return coincidencia[1] === '-' ? -minutos : minutos;
}

/** Medianoche (inicio del día) de AAAA-MM-DD en la zona horaria, como instante UTC. */
export function inicioDelDia(dia, zona = entorno.ZONA_HORARIA) {
  const [anio, mes, d] = dia.split('-').map(Number);
  const utc = Date.UTC(anio, mes - 1, d);
  return new Date(utc - desfaseMinutos(zona, new Date(utc)) * 60_000);
}

/** Inicio del día siguiente: sirve como límite exclusivo para que "hasta" incluya todo ese día. */
export function finDelDia(dia, zona = entorno.ZONA_HORARIA) {
  const [anio, mes, d] = dia.split('-').map(Number);
  const siguiente = new Date(Date.UTC(anio, mes - 1, d + 1)).toISOString().slice(0, 10);
  return inicioDelDia(siguiente, zona);
}
