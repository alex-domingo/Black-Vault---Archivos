import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { PATRON_NOMBRE_USUARIO, claveSegura, mensajeClave } from '../../../compartido/validadores';
import { ErrorApi } from '../../../nucleo/modelos/error-api';
import { CambiosUsuario, Rol, Usuario } from '../../../nucleo/modelos/usuario';
import { UsuariosApi } from '../../../nucleo/servicios/usuarios-api';

export interface DatosDialogoUsuario {
  /** Si viene, el diálogo edita; si no, crea. */
  usuario?: Usuario;
  /** Id del administrador que usa el diálogo (no puede cambiar su propio rol). */
  idActual: string;
}

const MB = 1024 * 1024;

/** Crear o editar un usuario. Envía los datos él mismo para mostrar los errores sin cerrarse. */
@Component({
  selector: 'app-dialogo-usuario',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  templateUrl: './dialogo-usuario.html',
  styles: `
    form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 16px;
      padding-top: 8px;
    }
    .completo {
      grid-column: 1 / -1;
    }
    @media (max-width: 599px) {
      form {
        grid-template-columns: 1fr;
      }
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
export class DialogoUsuario {
  private readonly api = inject(UsuariosApi);
  private readonly referencia = inject(MatDialogRef<DialogoUsuario, Usuario>);
  protected readonly datos = inject<DatosDialogoUsuario>(MAT_DIALOG_DATA);

  protected readonly editando = !!this.datos.usuario;
  protected readonly esUnoMismo = this.datos.usuario?._id === this.datos.idActual;
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mensajeClave = mensajeClave;

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombreUsuario: [
      this.datos.usuario?.nombreUsuario ?? '',
      this.editando ? [] : [Validators.required, Validators.pattern(PATRON_NOMBRE_USUARIO)],
    ],
    nombreCompleto: [this.datos.usuario?.nombreCompleto ?? '', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    correo: [this.datos.usuario?.correo ?? '', [Validators.required, Validators.email, Validators.maxLength(254)]],
    rol: [{ value: this.datos.usuario?.rol ?? ('usuario' as Rol), disabled: this.esUnoMismo }],
    cuotaMb: [
      this.datos.usuario ? Math.round(this.datos.usuario.almacenamiento.cuotaBytes / MB) : 100,
      [Validators.required, Validators.min(1), Validators.max(102_400)],
    ],
    clave: ['', this.editando ? [] : [Validators.required, claveSegura]],
  });

  constructor() {
    if (this.editando) this.formulario.controls.nombreUsuario.disable();
  }

  protected guardar(): void {
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    const valores = this.formulario.getRawValue();
    this.guardando.set(true);
    this.error.set(null);

    let peticion: Observable<Usuario>;
    if (this.datos.usuario) {
      const original = this.datos.usuario;
      // Solo se envían los datos que cambiaron.
      const cambios: CambiosUsuario = {};
      if (valores.nombreCompleto.trim() !== original.nombreCompleto) cambios.nombreCompleto = valores.nombreCompleto.trim();
      if (valores.correo.trim().toLowerCase() !== original.correo) cambios.correo = valores.correo.trim();
      if (!this.esUnoMismo && valores.rol !== original.rol) cambios.rol = valores.rol;
      if (valores.cuotaMb !== Math.round(original.almacenamiento.cuotaBytes / MB)) cambios.cuotaMb = valores.cuotaMb;
      if (Object.keys(cambios).length === 0) {
        this.referencia.close();
        return;
      }
      peticion = this.api.actualizar(original._id, cambios);
    } else {
      peticion = this.api.crear({
        nombreUsuario: valores.nombreUsuario.trim().toLowerCase(),
        nombreCompleto: valores.nombreCompleto.trim(),
        correo: valores.correo.trim(),
        rol: valores.rol,
        cuotaMb: valores.cuotaMb,
        clave: valores.clave,
      });
    }

    peticion.subscribe({
      next: (usuario) => this.referencia.close(usuario),
      error: (error: unknown) => {
        this.guardando.set(false);
        this.error.set(error instanceof ErrorApi ? this.mensajeDe(error) : 'No se pudo guardar el usuario.');
      },
    });
  }

  /** Si el servidor devolvió errores por campo, se muestran juntos. */
  private mensajeDe(error: ErrorApi): string {
    if (Array.isArray(error.detalles) && error.detalles.length) {
      return (error.detalles as { mensaje: string }[]).map((d) => d.mensaje).join(' ');
    }
    return error.message;
  }
}
