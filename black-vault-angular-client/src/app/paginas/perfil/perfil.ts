import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Avatar } from '../../compartido/componentes/avatar/avatar';
import { BytesPipe } from '../../compartido/pipes/bytes.pipe';
import { camposIguales, claveSegura, mensajeClave } from '../../compartido/validadores';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { AutenticacionApi } from '../../nucleo/servicios/autenticacion-api';
import { Notificador } from '../../nucleo/servicios/notificador';
import { Sesion } from '../../nucleo/servicios/sesion';

@Component({
  selector: 'app-perfil',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    Avatar,
    BytesPipe,
  ],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Perfil {
  private readonly sesion = inject(Sesion);
  private readonly api = inject(AutenticacionApi);
  private readonly notificador = inject(Notificador);

  protected readonly usuario = this.sesion.usuario;
  protected readonly porcentajeUso = computed(() => {
    const almacenamiento = this.usuario()?.almacenamiento;
    if (!almacenamiento || almacenamiento.cuotaBytes === 0) return 0;
    return Math.min(100, (almacenamiento.usadoBytes / almacenamiento.cuotaBytes) * 100);
  });

  protected readonly formularioClave = inject(NonNullableFormBuilder).group(
    {
      claveActual: ['', Validators.required],
      claveNueva: ['', [Validators.required, claveSegura]],
      confirmacion: ['', Validators.required],
    },
    { validators: camposIguales('claveNueva', 'confirmacion') },
  );
  protected readonly guardando = signal(false);
  protected readonly errorClave = signal<string | null>(null);
  protected readonly mensajeClave = mensajeClave;

  protected cambiarClave(directiva: FormGroupDirective): void {
    if (this.formularioClave.invalid || this.guardando()) {
      this.formularioClave.markAllAsTouched();
      return;
    }
    const { claveActual, claveNueva } = this.formularioClave.getRawValue();
    this.guardando.set(true);
    this.errorClave.set(null);

    this.api.cambiarClave(claveActual, claveNueva).subscribe({
      next: (respuesta) => {
        // El servidor invalida las sesiones anteriores y entrega un token nuevo para esta.
        this.sesion.establecer(respuesta);
        this.guardando.set(false);
        directiva.resetForm();
        this.notificador.exito('Contraseña actualizada. Las demás sesiones abiertas se cerraron.');
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.errorClave.set(error instanceof ErrorApi ? error.message : 'No se pudo cambiar la contraseña.');
      },
    });
  }
}
