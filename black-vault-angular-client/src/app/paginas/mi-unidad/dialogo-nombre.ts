import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable } from 'rxjs';
import { ErrorApi } from '../../nucleo/modelos/error-api';

export interface DatosDialogoNombre {
  titulo: string;
  etiqueta: string;
  valorInicial: string;
  textoBoton: string;
  /** Texto fijo al final (por ejemplo ".md" al renombrar un archivo). */
  sufijo?: string;
  /** Operación que se ejecuta al confirmar; el diálogo muestra sus errores sin cerrarse. */
  accion: (nombre: string) => Observable<unknown>;
}

/** Diálogo para crear una carpeta o renombrar un elemento. */
@Component({
  selector: 'app-dialogo-nombre',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ datos.titulo }}</h2>
    <mat-dialog-content>
      @if (error(); as texto) {
        <p class="mensaje-error" role="alert">{{ texto }}</p>
      }
      <form [formGroup]="formulario" (ngSubmit)="confirmar()" id="formulario-nombre" novalidate>
        <mat-form-field class="campo">
          <mat-label>{{ datos.etiqueta }}</mat-label>
          <input #entrada matInput formControlName="nombre" autocomplete="off" maxlength="250" />
          @if (datos.sufijo) {
            <span matTextSuffix>{{ datos.sufijo }}</span>
          }
          @if (formulario.controls.nombre.hasError('required')) {
            <mat-error>Escribe un nombre.</mat-error>
          } @else if (formulario.controls.nombre.hasError('pattern')) {
            <mat-error>No uses \\ / : * ? " &lt; &gt; |</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancelar</button>
      <button mat-flat-button type="submit" form="formulario-nombre" [disabled]="guardando()">
        {{ guardando() ? 'Guardando…' : datos.textoBoton }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .campo {
      width: min(420px, 75vw);
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
export class DialogoNombre {
  protected readonly datos = inject<DatosDialogoNombre>(MAT_DIALOG_DATA);
  private readonly referencia = inject(MatDialogRef<DialogoNombre, boolean>);
  private readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombre: [this.datos.valorInicial, [Validators.required, Validators.pattern(/^[^\\/:*?"<>|]*$/)]],
  });

  constructor() {
    // Selecciona el texto para poder reescribirlo de inmediato.
    afterNextRender(() => this.entrada().nativeElement.select());
  }

  protected confirmar(): void {
    const nombre = this.formulario.controls.nombre.value.trim();
    if (this.formulario.invalid || !nombre || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    if (nombre === this.datos.valorInicial) {
      this.referencia.close(false);
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.datos.accion(nombre).subscribe({
      next: () => this.referencia.close(true),
      error: (error: unknown) => {
        this.guardando.set(false);
        this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo guardar.');
      },
    });
  }
}
