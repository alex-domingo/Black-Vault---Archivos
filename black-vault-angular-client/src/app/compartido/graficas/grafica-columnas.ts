import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface ColumnaDato {
  /** Texto completo del período (tooltip). */
  etiqueta: string;
  /** Texto corto para el eje (se muestran solo algunos para que no se encimen). */
  corta: string;
  valor: number;
}

const numero = new Intl.NumberFormat('es-GT');

/** Máximo "redondo" para el eje: 1, 2 o 5 por una potencia de 10. */
function maximoRedondo(valor: number): number {
  if (valor <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const paso = [1, 2, 5, 10].find((p) => p * potencia >= valor)!;
  return paso * potencia;
}

/** Columnas verticales para series temporales (cantidades por día, semana o mes). */
@Component({
  selector: 'app-grafica-columnas',
  imports: [MatTooltipModule],
  template: `
    <div class="grafica" role="img" [attr.aria-label]="descripcion()" [style.--alto.px]="alto()">
      <div class="eje-y" aria-hidden="true">
        @for (marca of marcas(); track marca.valor) {
          <span [style.bottom.%]="marca.posicion">{{ marca.texto }}</span>
        }
      </div>
      <div class="area">
        @for (marca of marcas(); track marca.valor) {
          <span class="linea" [style.bottom.%]="marca.posicion" aria-hidden="true"></span>
        }
        <div class="columnas">
          @for (c of columnas(); track $index) {
            <div class="ranura" [matTooltip]="c.tooltip" matTooltipPosition="above">
              <span class="columna" [class.cero]="c.valor === 0" [style.height.%]="c.alto"></span>
            </div>
          }
        </div>
      </div>
      <div></div>
      <div class="eje-x" aria-hidden="true">
        @for (c of columnas(); track $index) {
          <span>{{ c.mostrarEtiqueta ? c.corta : '' }}</span>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .grafica {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      grid-template-rows: var(--alto) auto;
      column-gap: 8px;
    }
    .eje-y {
      position: relative;
    }
    .eje-y span {
      position: absolute;
      right: 0;
      transform: translateY(50%);
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .area {
      position: relative;
      border-bottom: 1px solid var(--mat-sys-outline);
    }
    .linea {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .columnas {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      gap: 2px;
    }
    .ranura {
      flex: 1;
      height: 100%;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .ranura:hover {
      background: color-mix(in srgb, var(--mat-sys-on-surface) 6%, transparent);
    }
    .columna {
      width: 100%;
      max-width: 24px;
      min-height: 2px;
      border-radius: 4px 4px 0 0;
      background: var(--mat-sys-primary);
    }
    .columna.cero {
      background: var(--mat-sys-outline-variant);
    }
    .eje-x {
      display: flex;
      gap: 2px;
      padding-top: 6px;
    }
    .eje-x span {
      flex: 1;
      min-width: 0;
      overflow: visible;
      white-space: nowrap;
      text-align: center;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficaColumnas {
  readonly datos = input.required<ColumnaDato[]>();
  readonly alto = input(180);
  readonly formato = input<(n: number) => string>((n) => numero.format(n));
  readonly descripcion = input('Gráfica de columnas');

  private readonly maximo = computed(() => maximoRedondo(Math.max(0, ...this.datos().map((d) => d.valor))));

  protected readonly marcas = computed(() => {
    const maximo = this.maximo();
    // Son cantidades: la marca intermedia solo se muestra si es un número entero.
    const valores = Number.isInteger(maximo / 2) ? [0, maximo / 2, maximo] : [0, maximo];
    return valores.map((valor) => ({ valor, posicion: (valor / maximo) * 100, texto: this.formato()(valor) }));
  });

  protected readonly columnas = computed(() => {
    const datos = this.datos();
    const maximo = this.maximo();
    // Como máximo unas 8 etiquetas en el eje.
    const cada = Math.max(1, Math.ceil(datos.length / 8));
    return datos.map((d, i) => ({
      ...d,
      alto: (d.valor / maximo) * 100,
      tooltip: `${d.etiqueta}: ${this.formato()(d.valor)}`,
      mostrarEtiqueta: i % cada === 0,
    }));
  });
}
