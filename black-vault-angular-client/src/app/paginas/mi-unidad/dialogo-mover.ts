import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Observable, catchError, of } from 'rxjs';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { NodoCarpeta } from '../../nucleo/modelos/documentos';
import { CarpetasApi } from '../../nucleo/servicios/carpetas-api';

export interface DatosDialogoMover {
  tipo: 'carpeta' | 'archivo';
  id: string;
  nombre: string;
  /** Carpeta donde está ahora (null = raíz). */
  ubicacionActual: string | null;
  accion: (destinoId: string | null) => Observable<unknown>;
}

interface Opcion {
  id: string | null;
  nombre: string;
  nivel: number;
  deshabilitada: boolean;
  motivo?: string;
}

/** Elegir la carpeta de destino en el árbol de "Mi unidad". */
@Component({
  selector: 'app-dialogo-mover',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Mover "{{ datos.nombre }}"</h2>
    <mat-dialog-content>
      @if (error(); as texto) {
        <p class="mensaje-error" role="alert">{{ texto }}</p>
      }
      @if (opciones() === null) {
        <mat-progress-bar mode="indeterminate" />
      } @else {
        <ul class="arbol" role="listbox" aria-label="Carpeta de destino">
          @for (opcion of opciones(); track opcion.id) {
            <li>
              <button
                type="button"
                role="option"
                class="opcion"
                [style.padding-left.px]="12 + opcion.nivel * 20"
                [class.elegida]="opcion.id === elegida()"
                [attr.aria-selected]="opcion.id === elegida()"
                [disabled]="opcion.deshabilitada"
                [title]="opcion.motivo ?? ''"
                (click)="elegida.set(opcion.id)"
              >
                <mat-icon aria-hidden="true">{{ opcion.id === null ? 'home_storage' : 'folder' }}</mat-icon>
                <span class="nombre">{{ opcion.nombre }}</span>
                @if (opcion.motivo) {
                  <span class="motivo">{{ opcion.motivo }}</span>
                }
              </button>
            </li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancelar</button>
      <button mat-flat-button type="button" [disabled]="!puedeMover() || moviendo()" (click)="mover()">
        {{ moviendo() ? 'Moviendo…' : 'Mover aquí' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .arbol {
      list-style: none;
      margin: 0;
      padding: 4px 0;
      min-width: min(440px, 75vw);
      max-height: 50vh;
      overflow-y: auto;
    }
    .opcion {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      border-radius: var(--mat-sys-corner-full);
      background: none;
      color: inherit;
      font: var(--mat-sys-body-large);
      text-align: left;
      cursor: pointer;
    }
    .opcion:hover:not(:disabled) {
      background: var(--mat-sys-surface-container-high);
    }
    .opcion.elegida {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .opcion:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    .opcion mat-icon {
      color: var(--mat-sys-primary);
    }
    .nombre {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .motivo {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .mensaje-error {
      margin: 0 0 12px;
      padding: 12px;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoMover {
  protected readonly datos = inject<DatosDialogoMover>(MAT_DIALOG_DATA);
  private readonly referencia = inject(MatDialogRef<DialogoMover, boolean>);

  protected readonly elegida = signal<string | null | undefined>(undefined);
  protected readonly moviendo = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly nodos = toSignal(
    inject(CarpetasApi)
      .arbol()
      .pipe(
        catchError((error: unknown) => {
          this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo cargar el árbol de carpetas.');
          return of<NodoCarpeta[]>([]);
        }),
      ),
    { initialValue: null },
  );

  /** Árbol aplanado en orden de recorrido, con la profundidad de cada carpeta. */
  protected readonly opciones = computed<Opcion[] | null>(() => {
    const nodos = this.nodos();
    if (nodos === null) return null;
    const hijos = new Map<string | null, NodoCarpeta[]>();
    for (const nodo of nodos) {
      const lista = hijos.get(nodo.padreId) ?? [];
      lista.push(nodo);
      hijos.set(nodo.padreId, lista);
    }
    const resultado: Opcion[] = [this.opcion(null, 'Mi unidad', 0)];
    const recorrer = (padre: string | null, nivel: number) => {
      for (const nodo of hijos.get(padre) ?? []) {
        resultado.push(this.opcion(nodo, nodo.nombre, nivel));
        // Una carpeta no puede moverse dentro de sí misma ni de sus subcarpetas: se ocultan sus descendientes.
        if (!(this.datos.tipo === 'carpeta' && nodo._id === this.datos.id)) recorrer(nodo._id, nivel + 1);
      }
    };
    recorrer(null, 1);
    return resultado;
  });

  protected readonly puedeMover = computed(() => {
    const elegida = this.elegida();
    return elegida !== undefined && elegida !== this.datos.ubicacionActual;
  });

  private opcion(nodo: NodoCarpeta | null, nombre: string, nivel: number): Opcion {
    const id = nodo?._id ?? null;
    if (this.datos.tipo === 'carpeta' && id === this.datos.id) {
      return { id, nombre, nivel, deshabilitada: true, motivo: 'es la carpeta que mueves' };
    }
    if (id === this.datos.ubicacionActual) {
      return { id, nombre, nivel, deshabilitada: true, motivo: 'ubicación actual' };
    }
    return { id, nombre, nivel, deshabilitada: false };
  }

  protected mover(): void {
    const destino = this.elegida();
    if (destino === undefined) return;
    this.moviendo.set(true);
    this.error.set(null);
    this.datos.accion(destino).subscribe({
      next: () => this.referencia.close(true),
      error: (error: unknown) => {
        this.moviendo.set(false);
        this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo mover.');
      },
    });
  }
}
