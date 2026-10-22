import { Pipe, PipeTransform } from '@angular/core';

const UNIDADES = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Formatea un tamaño en bytes: 1536 → "1.5 KB". Usa base 1024, igual que el servidor. */
export function formatearBytes(bytes: number | null | undefined, decimales = 1): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const indice = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNIDADES.length - 1);
  const valor = bytes / 1024 ** indice;
  const texto = valor.toFixed(valor >= 100 ? 0 : decimales).replace(/\.0+$/, '');
  return `${texto} ${UNIDADES[indice]}`;
}

@Pipe({ name: 'bytes' })
export class BytesPipe implements PipeTransform {
  transform(bytes: number | null | undefined, decimales = 1): string {
    return formatearBytes(bytes, decimales);
  }
}
