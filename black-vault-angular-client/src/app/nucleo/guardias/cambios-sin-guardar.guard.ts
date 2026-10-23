import { Injector, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';

/** Componentes que pueden tener cambios sin guardar (por ejemplo, el editor del visor). */
export interface ConCambiosSinGuardar {
  hayCambios(): boolean;
}

/**
 * Pide confirmación antes de salir si hay cambios sin guardar.
 * El diálogo se carga solo cuando hace falta, para no sumarlo al bundle inicial.
 */
export const confirmarCambiosSinGuardar: CanDeactivateFn<ConCambiosSinGuardar> = (componente) => {
  if (!componente.hayCambios()) return true;
  const inyector = inject(Injector);
  return (async () => {
    const [{ MatDialog }, { DialogoConfirmacion }] = await Promise.all([
      import('@angular/material/dialog'),
      import('../../compartido/componentes/dialogo-confirmacion/dialogo-confirmacion'),
    ]);
    const referencia = inyector.get(MatDialog).open(DialogoConfirmacion, {
      data: {
        titulo: 'Cambios sin guardar',
        mensaje: 'Si sales ahora perderás los cambios que hiciste en el documento.',
        textoConfirmar: 'Salir sin guardar',
        peligroso: true,
      },
    });
    return (await firstValueFrom(referencia.afterClosed())) === true;
  })();
};
