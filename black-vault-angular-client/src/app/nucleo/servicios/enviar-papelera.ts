import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TipoRecurso } from '../modelos/comparticiones';
import { Notificador } from './notificador';
import { PapeleraApi } from './papelera-api';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Envía un elemento a la papelera sin pedir confirmación: en su lugar ofrece "Deshacer",
 * que lo restaura al instante. (Eliminar definitivamente sí se confirma, en la papelera.)
 */
@Injectable({ providedIn: 'root' })
export class EnviarPapelera {
  private readonly api = inject(PapeleraApi);
  private readonly snackBar = inject(MatSnackBar);
  private readonly notificador = inject(Notificador);

  /** @param alCambiar Se llama al enviarlo y, si se deshace, al restaurarlo (para recargar la vista). */
  enviar(elemento: { tipo: TipoRecurso; _id: string; nombre: string }, alCambiar: () => void): void {
    this.api.enviar(elemento.tipo, elemento._id).subscribe({
      next: (resultado) => {
        alCambiar();
        // En una carpeta, "carpetas" la incluye a ella misma.
        const partes = [];
        if (elemento.tipo === 'carpeta') {
          if (resultado.elementos.archivos) partes.push(plural(resultado.elementos.archivos, 'archivo', 'archivos'));
          if (resultado.elementos.carpetas > 1) partes.push(plural(resultado.elementos.carpetas - 1, 'subcarpeta', 'subcarpetas'));
        }
        const contenido = partes.length ? ` con ${partes.join(' y ')}` : '';
        const aviso = this.snackBar.open(`"${elemento.nombre}" se envió a la papelera${contenido}.`, 'Deshacer', { duration: 8000 });
        aviso.onAction().subscribe(() => this.deshacer(elemento, alCambiar));
      },
      error: (error: unknown) => this.notificador.error(error, 'No se pudo enviar a la papelera.'),
    });
  }

  private deshacer(elemento: { tipo: TipoRecurso; _id: string; nombre: string }, alCambiar: () => void): void {
    this.api.restaurar(elemento.tipo, elemento._id).subscribe({
      next: (resultado) => {
        alCambiar();
        this.notificador.exito(
          resultado.nombre !== resultado.nombreAnterior ? `Se restauró como "${resultado.nombre}".` : `"${resultado.nombre}" se restauró.`,
        );
      },
      error: (error: unknown) => this.notificador.error(error, 'No se pudo deshacer.'),
    });
  }
}
