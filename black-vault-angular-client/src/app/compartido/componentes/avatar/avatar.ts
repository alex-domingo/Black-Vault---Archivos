import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Círculo con las iniciales del usuario. El tono se deriva del nombre para que sea estable. */
@Component({
  selector: 'app-avatar',
  template: `<span class="avatar" [style.--tono]="tono()" [style.--tamano.px]="tamano()" aria-hidden="true">{{ iniciales() }}</span>`,
  styles: `
    .avatar {
      display: inline-grid;
      place-items: center;
      width: var(--tamano);
      height: var(--tamano);
      border-radius: 50%;
      font: var(--mat-sys-label-large);
      font-size: calc(var(--tamano) * 0.4);
      color: hsl(var(--tono) 45% 22%);
      background: hsl(var(--tono) 70% 85%);
      flex-shrink: 0;
      user-select: none;
    }
    @media (prefers-color-scheme: dark) {
      .avatar {
        color: hsl(var(--tono) 70% 88%);
        background: hsl(var(--tono) 35% 30%);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly nombre = input.required<string>();
  readonly tamano = input(36);

  protected readonly iniciales = computed(() => {
    const partes = this.nombre().trim().split(/\s+/).filter(Boolean);
    const primera = partes[0]?.[0] ?? '?';
    const segunda = partes.length > 1 ? partes[1][0] : '';
    return (primera + segunda).toUpperCase();
  });

  protected readonly tono = computed(() => {
    let hash = 0;
    for (const caracter of this.nombre()) hash = (hash * 31 + caracter.codePointAt(0)!) % 360;
    return hash;
  });
}
