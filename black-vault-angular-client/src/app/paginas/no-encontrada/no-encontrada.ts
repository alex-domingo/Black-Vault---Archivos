import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-encontrada',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <section class="pagina">
      <mat-icon class="icono" aria-hidden="true">travel_explore</mat-icon>
      <h1>Página no encontrada</h1>
      <p>La dirección que buscas no existe o fue movida.</p>
      <a mat-flat-button routerLink="/mi-unidad">Ir a Mi unidad</a>
    </section>
  `,
  styles: `
    .pagina {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 48px 16px;
      text-align: center;
      box-sizing: border-box;
    }
    .icono {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--mat-sys-primary);
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
    }
    p {
      margin: 0 0 8px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoEncontrada {}
