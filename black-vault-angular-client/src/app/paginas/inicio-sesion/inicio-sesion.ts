import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { Sesion } from '../../nucleo/servicios/sesion';

/** Solo se permite volver a rutas internas (evita redirecciones abiertas a otros sitios). */
function rutaSegura(volver: string | undefined): string {
  return volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/mi-unidad';
}

@Component({
  selector: 'app-inicio-sesion',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './inicio-sesion.html',
  styleUrl: './inicio-sesion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioSesion {
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);

  /** Parámetros de consulta (?volver=/ruta&motivo=expirada) gracias a withComponentInputBinding. */
  readonly volver = input<string>();
  readonly motivo = input<string>();

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    identificador: ['', Validators.required],
    clave: ['', Validators.required],
  });

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarClave = signal(false);
  protected readonly aviso = computed(() =>
    this.motivo() === 'expirada' ? 'Tu sesión terminó. Vuelve a iniciar sesión para continuar.' : null,
  );

  protected entrar(): void {
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    const { identificador, clave } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);

    this.sesion.iniciarSesion(identificador.trim(), clave).subscribe({
      next: () => void this.router.navigateByUrl(rutaSegura(this.volver())),
      error: (error: unknown) => {
        this.enviando.set(false);
        this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo iniciar sesión.');
      },
    });
  }
}
