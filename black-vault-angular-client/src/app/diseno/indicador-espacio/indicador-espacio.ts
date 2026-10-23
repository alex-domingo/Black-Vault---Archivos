import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { BytesPipe } from '../../compartido/pipes/bytes.pipe';
import { Almacenamiento } from '../../nucleo/servicios/almacenamiento';
import { Sesion } from '../../nucleo/servicios/sesion';

/** Espacio usado por el usuario, al pie del menú lateral. */
@Component({
  selector: 'app-indicador-espacio',
  imports: [MatIconModule, MatProgressBarModule, RouterLink, BytesPipe],
  template: `
    @if (almacenamiento.estado(); as e) {
      <a class="espacio" routerLink="/perfil" [attr.aria-label]="'Espacio usado: ' + almacenamiento.porcentaje().toFixed(0) + '%'">
        <span class="titulo"><mat-icon aria-hidden="true">cloud</mat-icon>Almacenamiento</span>
        <mat-progress-bar mode="determinate" [value]="almacenamiento.porcentaje()" [class.lleno]="almacenamiento.porcentaje() >= 90" />
        <span class="detalle">{{ e.usadoBytes | bytes }} de {{ e.cuotaBytes | bytes }}</span>
      </a>
    }
  `,
  styles: `
    .espacio {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 8px;
      padding: 12px 16px;
      border-radius: var(--mat-sys-corner-large);
      color: inherit;
      text-decoration: none;
    }
    .espacio:hover {
      background: var(--mat-sys-surface-container-high);
    }
    .titulo {
      display: flex;
      align-items: center;
      gap: 8px;
      font: var(--mat-sys-label-large);
    }
    .titulo mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--mat-sys-primary);
    }
    .detalle {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .lleno {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadorEspacio {
  protected readonly almacenamiento = inject(Almacenamiento);
  private readonly sesion = inject(Sesion);

  constructor() {
    // Al cambiar de usuario (o al entrar) se consulta su espacio.
    effect(() => {
      const usuario = this.sesion.usuario();
      untracked(() => (usuario ? this.almacenamiento.refrescar() : this.almacenamiento.limpiar()));
    });
  }
}
