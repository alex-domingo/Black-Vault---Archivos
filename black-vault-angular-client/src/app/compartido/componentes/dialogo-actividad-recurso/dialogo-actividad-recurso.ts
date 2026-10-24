import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Actividad } from '../../../nucleo/modelos/actividad';
import { TipoRecurso } from '../../../nucleo/modelos/comparticiones';
import { ErrorApi } from '../../../nucleo/modelos/error-api';
import { ActividadesApi } from '../../../nucleo/servicios/actividades-api';
import { Sesion } from '../../../nucleo/servicios/sesion';
import { ListaActividad } from '../lista-actividad/lista-actividad';

export interface DatosActividadRecurso {
  tipo: TipoRecurso;
  id: string;
  nombre: string;
}

const POR_PAGINA = 30;

/** Línea de tiempo de un archivo o una carpeta (propietario y administrador). */
@Component({
  selector: 'app-dialogo-actividad-recurso',
  imports: [MatButtonModule, MatDialogModule, MatProgressBarModule, ListaActividad],
  template: `
    <h2 mat-dialog-title>Actividad de "{{ datos.nombre }}"</h2>
    <mat-dialog-content>
      @if (error(); as texto) {
        <p class="mensaje-error" role="alert">{{ texto }}</p>
      }
      <app-lista-actividad [actividades]="actividades()" [mostrarIp]="admin()" />
      @if (cargando()) {
        <mat-progress-bar mode="indeterminate" aria-label="Cargando" />
      } @else if (actividades().length === 0 && !error()) {
        <p class="vacio">Sin actividad registrada.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <span class="conteo">{{ actividades().length }} de {{ total() }}</span>
      @if (hayMas()) {
        <button mat-button (click)="cargarMas()" [disabled]="cargando()">Cargar más</button>
      }
      <button mat-flat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: min(560px, 80vw);
    }
    mat-dialog-actions {
      gap: 8px;
    }
    .conteo {
      margin-right: auto;
      padding-left: 8px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .vacio {
      color: var(--mat-sys-on-surface-variant);
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
export class DialogoActividadRecurso {
  protected readonly datos = inject<DatosActividadRecurso>(MAT_DIALOG_DATA);
  private readonly api = inject(ActividadesApi);
  private readonly sesion = inject(Sesion);

  protected readonly admin = computed(() => this.sesion.usuario()?.rol === 'administrador');
  protected readonly actividades = signal<Actividad[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hayMas = computed(() => this.actividades().length < this.total());
  private pagina = 0;

  constructor() {
    this.cargarMas();
  }

  protected cargarMas(): void {
    this.cargando.set(true);
    this.pagina++;
    this.api.deRecurso(this.datos.tipo, this.datos.id, { pagina: this.pagina, limite: POR_PAGINA }).subscribe({
      next: (r) => {
        this.cargando.set(false);
        this.total.set(r.total);
        this.actividades.update((actual) => [...actual, ...r.datos]);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.pagina--;
        this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo cargar la actividad.');
      },
    });
  }
}
