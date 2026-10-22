import { Injectable, Provider } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/**
 * Textos del paginador de Angular Material en español.
 * Se provee en cada página con paginador (proveerPaginadorEs) y no en app.config,
 * para no cargar el paginador en el bundle inicial.
 */
@Injectable()
export class PaginadorEs extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Elementos por página';
  override nextPageLabel = 'Página siguiente';
  override previousPageLabel = 'Página anterior';
  override firstPageLabel = 'Primera página';
  override lastPageLabel = 'Última página';

  override getRangeLabel = (pagina: number, tamano: number, total: number): string => {
    if (total === 0 || tamano === 0) return `0 de ${total}`;
    const inicio = pagina * tamano;
    const fin = Math.min(inicio + tamano, total);
    return `${inicio + 1}–${fin} de ${total}`;
  };
}

/** Proveedor para el arreglo `providers` de un componente con mat-paginator. */
export const proveerPaginadorEs: Provider = { provide: MatPaginatorIntl, useClass: PaginadorEs };
