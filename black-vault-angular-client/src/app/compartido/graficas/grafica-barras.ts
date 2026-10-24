import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface BarraDato {
  etiqueta: string;
  /** Un valor por serie (se apilan en ese orden). */
  valores: number[];
  /** Texto secundario bajo la etiqueta (por ejemplo, el usuario). */
  detalle?: string;
}

export interface SerieBarras {
  nombre: string;
  /** Rol de color: primario (la medida principal), neutro (lo inactivo, como la papelera) o terciario. */
  color?: 'primario' | 'neutro' | 'terciario';
}

const numero = new Intl.NumberFormat('es-GT');

/**
 * Barras horizontales para rankings y comparaciones de magnitud.
 * Una serie: sin leyenda (el título la nombra). Dos o más: leyenda y segmentos apilados
 * separados por un espacio del color de la superficie.
 */
@Component({
  selector: 'app-grafica-barras',
  imports: [MatTooltipModule],
  template: `
    @if (series().length > 1) {
      <ul class="leyenda" aria-hidden="true">
        @for (s of series(); track s.nombre) {
          <li><span class="muestra" [attr.data-color]="s.color ?? 'primario'"></span>{{ s.nombre }}</li>
        }
      </ul>
    }
    <div class="barras" role="img" [attr.aria-label]="descripcion()">
      @for (fila of filas(); track $index) {
        <div class="fila" [matTooltip]="fila.tooltip" matTooltipPosition="above">
          <div class="etiqueta">
            <span class="principal">{{ fila.etiqueta }}</span>
            @if (fila.detalle) {
              <span class="detalle">{{ fila.detalle }}</span>
            }
          </div>
          <div class="pista">
            @for (seg of fila.segmentos; track $index) {
              @if (seg.ancho > 0) {
                <span class="segmento" [attr.data-color]="seg.color" [style.width.%]="seg.ancho"></span>
              }
            }
            <span class="valor">{{ fila.total }}</span>
          </div>
        </div>
      } @empty {
        <p class="vacio">Sin datos para mostrar.</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      --barra-primario: var(--mat-sys-primary);
      --barra-neutro: var(--mat-sys-outline);
      --barra-terciario: var(--mat-sys-tertiary);
    }
    .leyenda {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin: 0 0 12px;
      padding: 0;
      list-style: none;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .leyenda li {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .muestra {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }
    .fila {
      display: grid;
      grid-template-columns: minmax(96px, 34%) minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      min-height: 36px;
      padding: 2px 0;
    }
    .fila:hover .segmento {
      filter: brightness(1.12);
    }
    .etiqueta {
      display: flex;
      flex-direction: column;
      min-width: 0;
      text-align: right;
    }
    .principal {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .detalle {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pista {
      display: flex;
      align-items: center;
      gap: 2px;
      height: 20px;
      border-left: 1px solid var(--mat-sys-outline-variant);
    }
    .segmento {
      height: 100%;
      min-width: 2px;
    }
    .segmento:last-of-type {
      border-radius: 0 4px 4px 0;
    }
    [data-color='primario'] {
      background: var(--barra-primario);
    }
    [data-color='neutro'] {
      background: var(--barra-neutro);
    }
    [data-color='terciario'] {
      background: var(--barra-terciario);
    }
    .valor {
      margin-left: 6px;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }
    .vacio {
      margin: 0;
      padding: 24px 0;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    @media (max-width: 599px) {
      .fila {
        grid-template-columns: minmax(0, 1fr);
        gap: 2px;
      }
      .etiqueta {
        text-align: left;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficaBarras {
  readonly datos = input.required<BarraDato[]>();
  readonly series = input<SerieBarras[]>([{ nombre: 'Valor' }]);
  readonly formato = input<(n: number) => string>((n) => numero.format(n));
  /** Resumen para lectores de pantalla. */
  readonly descripcion = input('Gráfica de barras');

  protected readonly filas = computed(() => {
    const datos = this.datos();
    const series = this.series();
    const formato = this.formato();
    // Escala con un poco de aire para que el valor quepa a la derecha de la barra más larga.
    const maximo = Math.max(1, ...datos.map((d) => d.valores.reduce((s, v) => s + v, 0))) * 1.08;
    return datos.map((d) => {
      const total = d.valores.reduce((s, v) => s + v, 0);
      const partes = series.map((s, i) => `${s.nombre}: ${formato(d.valores[i] ?? 0)}`);
      return {
        etiqueta: d.etiqueta,
        detalle: d.detalle,
        total: formato(total),
        tooltip: series.length > 1 ? `${d.etiqueta} — ${partes.join(' · ')}` : `${d.etiqueta}: ${formato(total)}`,
        segmentos: series.map((s, i) => ({ color: s.color ?? 'primario', ancho: ((d.valores[i] ?? 0) / maximo) * 100 })),
      };
    });
  });
}
