import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface DatosConfirmacion {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  /** Resalta el botón como acción delicada (desactivar, eliminar…). */
  peligroso?: boolean;
}

/** Diálogo genérico de confirmación. Se cierra con true si el usuario confirma. */
@Component({
  selector: 'app-dialogo-confirmacion',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ datos.titulo }}</h2>
    <mat-dialog-content>
      <p>{{ datos.mensaje }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancelar</button>
      <button mat-flat-button [class.peligroso]="datos.peligroso" [mat-dialog-close]="true" cdkFocusInitial>
        {{ datos.textoConfirmar ?? 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    p {
      margin: 0;
    }
    .peligroso {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoConfirmacion {
  protected readonly datos = inject<DatosConfirmacion>(MAT_DIALOG_DATA);
}
