import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { descargarCsv } from '../../../compartido/csv';

export interface DatosCsv {
  nombre: string;
  encabezados: string[];
  filas: (string | number | null | undefined)[][];
}

/** Marco común de un reporte: título, descripción, filtros, estado de carga y exportación a CSV. */
@Component({
  selector: 'app-tarjeta-reporte',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  template: `
    <section class="tarjeta" [attr.aria-labelledby]="'titulo-' + codigo()">
      <header class="cabecera">
        <div>
          <span class="codigo">{{ codigo() }}</span>
          <h2 [id]="'titulo-' + codigo()">{{ titulo() }}</h2>
          <p class="descripcion">{{ descripcion() }}</p>
        </div>
        @if (csv(); as c) {
          <button mat-stroked-button (click)="exportar(c)" [disabled]="!c.filas.length" matTooltip="Descargar la tabla en CSV (Excel)">
            <mat-icon>download</mat-icon>CSV
          </button>
        }
      </header>
      <div class="filtros"><ng-content select="[filtros]" /></div>
      <div class="cuerpo">
        @if (cargando()) {
          <mat-progress-bar mode="indeterminate" class="carga" aria-label="Generando el reporte" />
        }
        @if (error(); as texto) {
          <p class="error" role="alert">{{ texto }}</p>
        } @else {
          <ng-content />
        }
      </div>
    </section>
  `,
  styles: `
    .tarjeta {
      padding: 20px 24px 24px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container-lowest);
    }
    .cabecera {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .codigo {
      display: inline-block;
      margin-bottom: 4px;
      padding: 1px 8px;
      border-radius: var(--mat-sys-corner-full);
      font: var(--mat-sys-label-small);
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-large);
    }
    .descripcion {
      margin: 4px 0 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .filtros:not(:empty) {
      margin-top: 16px;
    }
    .cuerpo {
      position: relative;
      margin-top: 16px;
      min-height: 80px;
    }
    .carga {
      position: absolute;
      inset: -8px 0 auto;
    }
    .error {
      margin: 0;
      padding: 12px;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    @media (max-width: 599px) {
      .tarjeta {
        padding: 16px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarjetaReporte {
  readonly codigo = input.required<string>();
  readonly titulo = input.required<string>();
  readonly descripcion = input('');
  readonly cargando = input(false);
  readonly error = input<string | null>(null);
  readonly csv = input<DatosCsv | null>(null);

  protected exportar(c: DatosCsv): void {
    descargarCsv(c.nombre, c.encabezados, c.filas);
  }
}
