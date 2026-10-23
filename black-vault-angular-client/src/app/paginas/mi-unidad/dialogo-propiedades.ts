import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CampoEtiquetas } from '../../compartido/componentes/campo-etiquetas/campo-etiquetas';
import { Archivo, CATEGORIAS, Categoria } from '../../nucleo/modelos/documentos';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { ArchivosApi, CambiosArchivo } from '../../nucleo/servicios/archivos-api';

/** Clasificación de un archivo: categoría, etiquetas y descripción. */
@Component({
  selector: 'app-dialogo-propiedades',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, CampoEtiquetas],
  template: `
    <h2 mat-dialog-title>Clasificar "{{ archivo.nombre }}"</h2>
    <mat-dialog-content>
      @if (error(); as texto) {
        <p class="mensaje-error" role="alert">{{ texto }}</p>
      }
      <form [formGroup]="formulario" (ngSubmit)="guardar()" id="formulario-propiedades" novalidate>
        <mat-form-field>
          <mat-label>Categoría</mat-label>
          <mat-select formControlName="categoria">
            @for (c of categorias; track c.valor) {
              <mat-option [value]="c.valor">{{ c.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <app-campo-etiquetas [control]="etiquetas" />
        <mat-form-field>
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="descripcion" rows="3" maxlength="500"></textarea>
          <mat-hint align="end">{{ formulario.controls.descripcion.value.length }}/500</mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancelar</button>
      <button mat-flat-button type="submit" form="formulario-propiedades" [disabled]="guardando()">
        {{ guardando() ? 'Guardando…' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: min(460px, 75vw);
      padding-top: 8px;
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
export class DialogoPropiedades {
  private readonly api = inject(ArchivosApi);
  private readonly referencia = inject(MatDialogRef<DialogoPropiedades, Archivo>);
  protected readonly archivo = inject<Archivo>(MAT_DIALOG_DATA);
  protected readonly categorias = CATEGORIAS;
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    categoria: [this.archivo.categoria as Categoria, Validators.required],
    descripcion: [this.archivo.descripcion, Validators.maxLength(500)],
  });
  protected readonly etiquetas = new FormControl<string[]>([...this.archivo.etiquetas], { nonNullable: true });

  protected guardar(): void {
    if (this.formulario.invalid || this.guardando()) return;
    const { categoria, descripcion } = this.formulario.getRawValue();
    const cambios: CambiosArchivo = {};
    if (categoria !== this.archivo.categoria) cambios.categoria = categoria;
    if (descripcion.trim() !== this.archivo.descripcion) cambios.descripcion = descripcion.trim();
    if (JSON.stringify(this.etiquetas.value) !== JSON.stringify(this.archivo.etiquetas)) cambios.etiquetas = this.etiquetas.value;
    if (Object.keys(cambios).length === 0) {
      this.referencia.close();
      return;
    }
    this.guardando.set(true);
    this.api.actualizar(this.archivo._id, cambios).subscribe({
      next: (archivo) => this.referencia.close(archivo),
      error: (error: unknown) => {
        this.guardando.set(false);
        this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo guardar.');
      },
    });
  }
}
