import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Ícono de carpeta o de archivo según su tipo (.md / .txt). */
@Component({
  selector: 'app-icono-archivo',
  imports: [MatIconModule],
  template: `<mat-icon [class]="clase()" aria-hidden="true">{{ icono() }}</mat-icon>`,
  styles: `
    :host {
      display: inline-flex;
    }
    .carpeta {
      color: var(--mat-sys-primary);
      font-variation-settings: 'FILL' 1;
    }
    .md {
      color: var(--mat-sys-tertiary);
    }
    .txt {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconoArchivo {
  readonly tipo = input.required<'carpeta' | 'archivo'>();
  readonly extension = input<string>();

  protected readonly icono = computed(() => {
    if (this.tipo() === 'carpeta') return 'folder';
    return this.extension() === 'md' ? 'markdown' : 'description';
  });

  protected readonly clase = computed(() => (this.tipo() === 'carpeta' ? 'carpeta' : this.extension() === 'md' ? 'md' : 'txt'));
}
