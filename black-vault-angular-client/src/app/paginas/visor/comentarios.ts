import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Avatar } from '../../compartido/componentes/avatar/avatar';
import { ComentariosArchivo } from '../../nucleo/modelos/comparticiones';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { ArchivosApi } from '../../nucleo/servicios/archivos-api';
import { Notificador } from '../../nucleo/servicios/notificador';

const MAXIMO = 1000;

/** Comentarios de un archivo: verlos basta con lectura; escribir requiere el nivel "comentar". */
@Component({
  selector: 'app-comentarios',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    Avatar,
  ],
  template: `
    <section class="comentarios" aria-labelledby="titulo-comentarios">
      <h2 id="titulo-comentarios">
        <mat-icon aria-hidden="true">forum</mat-icon>
        Comentarios
        @if (datos(); as d) {
          <span class="conteo">{{ d.comentarios.length }}</span>
        }
      </h2>

      @if (error(); as texto) {
        <p class="mensaje-error" role="alert">{{ texto }}</p>
      } @else if (datos() === null) {
        <mat-progress-bar mode="indeterminate" aria-label="Cargando comentarios" />
      } @else {
        @let d = datos()!;
        <ol class="lista">
          @for (c of d.comentarios; track c._id) {
            <li class="comentario">
              <app-avatar [nombre]="c.autor.nombreCompleto" [tamano]="32" />
              <div class="cuerpo">
                <div class="encabezado">
                  <span class="autor">{{ c.autor.nombreCompleto }}</span>
                  <time [attr.datetime]="c.creadoEn">{{ c.creadoEn | date: 'medium' }}</time>
                  @if (c.puedeEliminar) {
                    <button
                      mat-icon-button
                      class="eliminar"
                      (click)="eliminar(c._id)"
                      [disabled]="eliminando() === c._id"
                      matTooltip="Eliminar comentario"
                      [attr.aria-label]="'Eliminar el comentario de ' + c.autor.nombreCompleto"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  }
                </div>
                <p class="texto">{{ c.texto }}</p>
              </div>
            </li>
          } @empty {
            <li class="vacio">Todavía no hay comentarios.</li>
          }
        </ol>

        @if (d.puedeComentar) {
          @if (lleno()) {
            <p class="aviso">Este archivo alcanzó el límite de {{ d.limite }} comentarios.</p>
          } @else {
            <form class="nuevo" [formGroup]="formulario" (ngSubmit)="publicar()" novalidate>
              <mat-form-field subscriptSizing="dynamic">
                <mat-label>Escribe un comentario</mat-label>
                <textarea matInput formControlName="texto" rows="2" [maxlength]="maximo" cdkTextareaAutosize></textarea>
                <mat-hint align="end">{{ texto.value.length }} / {{ maximo }}</mat-hint>
              </mat-form-field>
              <button mat-flat-button type="submit" [disabled]="enviando() || !texto.value.trim()">
                <mat-icon>send</mat-icon>{{ enviando() ? 'Publicando…' : 'Comentar' }}
              </button>
            </form>
          }
        } @else {
          <p class="aviso">Tu permiso es de lectura: puedes ver los comentarios, pero no escribir.</p>
        }
      }
    </section>
  `,
  styles: `
    .comentarios {
      margin-top: 24px;
      padding: 20px 24px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container-low);
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px;
      font: var(--mat-sys-title-medium);
    }
    h2 mat-icon {
      color: var(--mat-sys-primary);
    }
    .conteo {
      padding: 0 8px;
      border-radius: var(--mat-sys-corner-full);
      font: var(--mat-sys-label-medium);
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .lista {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .comentario {
      display: flex;
      gap: 12px;
      padding: 10px 0;
    }
    .comentario + .comentario {
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .cuerpo {
      flex: 1;
      min-width: 0;
    }
    .encabezado {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 10px;
      min-height: 32px;
    }
    .autor {
      font: var(--mat-sys-label-large);
    }
    time {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .eliminar {
      margin-left: auto;
    }
    .texto {
      margin: 2px 0 0;
      font: var(--mat-sys-body-medium);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .vacio,
    .aviso {
      margin: 8px 0 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .nuevo {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 12px;
      margin-top: 12px;
    }
    .nuevo mat-form-field {
      flex: 1 1 280px;
    }
    .nuevo button {
      margin-top: 8px;
    }
    .mensaje-error {
      margin: 0;
      padding: 12px;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Comentarios {
  private readonly api = inject(ArchivosApi);
  private readonly notificador = inject(Notificador);

  readonly archivoId = input.required<string>();

  protected readonly maximo = MAXIMO;
  protected readonly datos = signal<ComentariosArchivo | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly eliminando = signal<string | null>(null);
  protected readonly texto = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(MAXIMO)] });
  protected readonly formulario = new FormGroup({ texto: this.texto });
  protected readonly lleno = computed(() => {
    const d = this.datos();
    return !!d && d.comentarios.length >= d.limite;
  });

  constructor() {
    effect(() => {
      const id = this.archivoId();
      untracked(() => this.cargar(id));
    });
  }

  private cargar(id: string): void {
    this.datos.set(null);
    this.error.set(null);
    this.api.comentarios(id).subscribe({
      next: (datos) => this.datos.set(datos),
      error: (error: unknown) => this.error.set(error instanceof ErrorApi ? error.message : 'No se pudieron cargar los comentarios.'),
    });
  }

  protected publicar(): void {
    const texto = this.texto.value.trim();
    if (!texto || this.enviando()) return;
    this.enviando.set(true);
    this.api.comentar(this.archivoId(), texto).subscribe({
      next: (comentario) => {
        this.enviando.set(false);
        this.texto.setValue('');
        this.datos.update((d) => (d ? { ...d, comentarios: [...d.comentarios, comentario] } : d));
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.notificador.error(error, 'No se pudo publicar el comentario.');
        // Si cambió el permiso o se llenó, se vuelve a consultar el estado real.
        if (error instanceof ErrorApi && (error.estado === 403 || error.estado === 409)) this.cargar(this.archivoId());
      },
    });
  }

  protected eliminar(comentarioId: string): void {
    this.eliminando.set(comentarioId);
    this.api.eliminarComentario(this.archivoId(), comentarioId).subscribe({
      next: () => {
        this.eliminando.set(null);
        this.datos.update((d) => (d ? { ...d, comentarios: d.comentarios.filter((c) => c._id !== comentarioId) } : d));
        this.notificador.exito('Comentario eliminado.');
      },
      error: (error: unknown) => {
        this.eliminando.set(null);
        this.notificador.error(error, 'No se pudo eliminar el comentario.');
      },
    });
  }
}
