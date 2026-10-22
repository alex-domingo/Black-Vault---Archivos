import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorApi } from '../modelos/error-api';

/** Mensajes breves en la parte inferior de la pantalla. */
@Injectable({ providedIn: 'root' })
export class Notificador {
  private readonly snackBar = inject(MatSnackBar);

  exito(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
  }

  error(error: unknown, alternativo = 'No se pudo completar la operación.'): void {
    const mensaje = error instanceof ErrorApi ? error.message : alternativo;
    this.snackBar.open(mensaje, 'Cerrar', { duration: 6000, panelClass: 'notificacion-error' });
  }
}
