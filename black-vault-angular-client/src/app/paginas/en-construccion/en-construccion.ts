import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Página provisional para las secciones que se construyen en fases posteriores.
 * Recibe sus datos desde la propiedad `data` de la ruta (withComponentInputBinding).
 */
@Component({
  selector: 'app-en-construccion',
  imports: [MatIconModule],
  template: `
    <section class="tarjeta">
      <mat-icon class="icono" aria-hidden="true">{{ icono() }}</mat-icon>
      <h1>{{ titulo() }}</h1>
      <p>{{ descripcion() }}</p>
      <p class="fase">Disponible en la fase {{ fase() }}</p>
    </section>
  `,
  styles: `
    .tarjeta {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
      padding: 48px 24px;
      border-radius: var(--mat-sys-corner-extra-large);
      background: var(--mat-sys-surface-container-low);
    }
    .icono {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: var(--mat-sys-primary);
    }
    h1 {
      margin: 8px 0 0;
      font: var(--mat-sys-headline-small);
    }
    p {
      margin: 0;
      max-width: 520px;
      color: var(--mat-sys-on-surface-variant);
    }
    .fase {
      margin-top: 8px;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-tertiary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnConstruccion {
  readonly titulo = input('');
  readonly icono = input('construction');
  readonly descripcion = input('');
  readonly fase = input<number>();
}
