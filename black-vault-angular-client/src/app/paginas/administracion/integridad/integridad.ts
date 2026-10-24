import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ErrorApi } from '../../../nucleo/modelos/error-api';
import { InformeIntegridad } from '../../../nucleo/modelos/integridad';
import { ActividadesApi } from '../../../nucleo/servicios/actividades-api';

/** Verificación de integridad de la base (diseño, 5.15). Solo administradores. */
@Component({
  selector: 'app-integridad',
  imports: [DatePipe, JsonPipe, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <header class="cabecera-pagina">
      <div>
        <h1>Integridad de los datos</h1>
        <p>Comprobaciones hechas con aggregation pipelines sobre toda la base de datos.</p>
      </div>
      <button mat-flat-button (click)="verificar()" [disabled]="cargando()"><mat-icon>fact_check</mat-icon>Volver a verificar</button>
    </header>

    @if (cargando()) {
      <mat-progress-bar mode="indeterminate" aria-label="Verificando" />
    }
    @if (error(); as texto) {
      <p class="mensaje-error" role="alert">{{ texto }}</p>
    }

    @if (informe(); as i) {
      <div class="resumen" [class.mal]="!i.correcto" role="status">
        <mat-icon aria-hidden="true">{{ i.correcto ? 'verified' : 'report' }}</mat-icon>
        <div>
          <strong>{{ i.correcto ? 'La base de datos está íntegra.' : 'Se encontraron problemas.' }}</strong>
          <span>Verificado el {{ i.revisadoEn | date: 'medium' }}</span>
        </div>
      </div>

      <ul class="verificaciones">
        @for (v of i.verificaciones; track v.clave) {
          <li class="verificacion" [class.mal]="v.problemas > 0">
            <mat-icon class="estado" aria-hidden="true">{{ v.problemas ? 'error' : 'check_circle' }}</mat-icon>
            <div class="cuerpo">
              <h2>{{ v.titulo }}</h2>
              <p>{{ v.descripcion }}</p>
              @if (v.problemas) {
                <p class="cuenta">
                  {{ v.problemas }} problema(s).
                  {{ v.reparable ? 'Se puede reparar con el script.' : 'Requiere revisión manual.' }}
                </p>
                <details>
                  <summary>Ver ejemplos</summary>
                  <pre>{{ v.ejemplos | json }}</pre>
                </details>
              }
            </div>
            <span class="numero" [attr.aria-label]="v.problemas + ' problemas'">{{ v.problemas }}</span>
          </li>
        }
      </ul>

      @if (!i.correcto) {
        <p class="instrucciones">
          Para reparar lo que se puede corregir automáticamente, ejecuta en el servidor:
          <code>npm run integridad -- --reparar</code>
        </p>
      }
    }
  `,
  styles: `
    .cabecera-pagina {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 4px;
      font: var(--mat-sys-headline-small);
    }
    .cabecera-pagina p {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .resumen {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 16px 0;
      padding: 16px;
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .resumen.mal {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .resumen div {
      display: flex;
      flex-direction: column;
    }
    .resumen span {
      font: var(--mat-sys-body-small);
    }
    .verificaciones {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-large);
      overflow: hidden;
    }
    .verificacion {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
      padding: 16px;
    }
    .verificacion + .verificacion {
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .estado {
      color: var(--mat-sys-primary);
    }
    .mal .estado,
    .cuenta {
      color: var(--mat-sys-error);
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .cuerpo p {
      margin: 4px 0 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .numero {
      font: var(--mat-sys-headline-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .mal .numero {
      color: var(--mat-sys-error);
    }
    pre {
      max-height: 240px;
      overflow: auto;
      padding: 8px;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-surface-container);
      font-size: 12px;
    }
    .instrucciones code {
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--mat-sys-surface-container-high);
    }
    .mensaje-error {
      padding: 12px;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Integridad {
  private readonly api = inject(ActividadesApi);
  protected readonly informe = signal<InformeIntegridad | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.verificar();
  }

  protected verificar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.integridad().subscribe({
      next: (informe) => {
        this.cargando.set(false);
        this.informe.set(informe);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo verificar la integridad.');
      },
    });
  }
}
