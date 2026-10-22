import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { camposIguales, claveSegura, mensajeClave } from '../../../compartido/validadores';
import { ErrorApi } from '../../../nucleo/modelos/error-api';
import { Usuario } from '../../../nucleo/modelos/usuario';
import { UsuariosApi } from '../../../nucleo/servicios/usuarios-api';

/** El administrador asigna una contraseña nueva. Las sesiones del usuario se cierran. */
@Component({
  selector: 'app-dialogo-restablecer-clave',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Restablecer contraseña</h2>
    <mat-dialog-content>
      <p class="explicacion">
        Asigna una contraseña nueva a <strong>{{ usuario.nombreCompleto }}</strong>. Sus sesiones abiertas se cerrarán.
      </p>
      @if (error(); as texto) {
        <p class="mensaje-error" role="alert">{{ texto }}</p>
      }
      <form [formGroup]="formulario" (ngSubmit)="guardar()" id="formulario-clave" novalidate>
        <mat-form-field>
          <mat-label>Nueva contraseña</mat-label>
          <input matInput type="password" formControlName="claveNueva" autocomplete="new-password" />
          <mat-hint>8+ caracteres, letras y números</mat-hint>
          @if (formulario.controls.claveNueva.invalid) {
            <mat-error>{{ mensajeClave(formulario.controls.claveNueva) }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Confirmar contraseña</mat-label>
          <input matInput type="password" formControlName="confirmacion" autocomplete="new-password" />
          @if (formulario.controls.confirmacion.hasError('required')) {
            <mat-error>Repite la contraseña.</mat-error>
          } @else if (formulario.controls.confirmacion.hasError('noCoincide')) {
            <mat-error>Las contraseñas no coinciden.</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancelar</button>
      <button mat-flat-button type="submit" form="formulario-clave" [disabled]="guardando()">
        {{ guardando() ? 'Guardando…' : 'Restablecer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: min(360px, 70vw);
    }
    .explicacion {
      margin: 0 0 16px;
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
export class DialogoRestablecerClave {
  private readonly api = inject(UsuariosApi);
  private readonly referencia = inject(MatDialogRef<DialogoRestablecerClave, boolean>);
  protected readonly usuario = inject<Usuario>(MAT_DIALOG_DATA);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mensajeClave = mensajeClave;

  protected readonly formulario = inject(NonNullableFormBuilder).group(
    {
      claveNueva: ['', [Validators.required, claveSegura]],
      confirmacion: ['', Validators.required],
    },
    { validators: camposIguales('claveNueva', 'confirmacion') },
  );

  protected guardar(): void {
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.api.restablecerClave(this.usuario._id, this.formulario.getRawValue().claveNueva).subscribe({
      next: () => this.referencia.close(true),
      error: (error: unknown) => {
        this.guardando.set(false);
        this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo restablecer la contraseña.');
      },
    });
  }
}
