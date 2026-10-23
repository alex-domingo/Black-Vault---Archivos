import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { marked } from 'marked';

/**
 * Muestra Markdown como HTML. El HTML pasa por [innerHTML], que Angular sanitiza
 * (elimina scripts, atributos on* y URLs peligrosas): un documento malicioso no puede ejecutar código.
 */
@Component({
  selector: 'app-vista-markdown',
  template: `<article class="markdown" [innerHTML]="html()"></article>`,
  // Sin encapsulación: los estilos deben llegar al HTML generado por marked.
  encapsulation: ViewEncapsulation.None,
  styles: `
    app-vista-markdown .markdown {
      font: var(--mat-sys-body-large);
      line-height: 1.6;
      overflow-wrap: anywhere;
    }
    app-vista-markdown .markdown h1,
    app-vista-markdown .markdown h2,
    app-vista-markdown .markdown h3 {
      line-height: 1.25;
      margin: 1.4em 0 0.5em;
    }
    app-vista-markdown .markdown h1 {
      font: var(--mat-sys-headline-small);
      margin-top: 0;
    }
    app-vista-markdown .markdown h2 {
      font: var(--mat-sys-title-large);
      padding-bottom: 4px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    app-vista-markdown .markdown h3 {
      font: var(--mat-sys-title-medium);
    }
    app-vista-markdown .markdown table {
      border-collapse: collapse;
      margin: 1em 0;
      display: block;
      overflow-x: auto;
    }
    app-vista-markdown .markdown th,
    app-vista-markdown .markdown td {
      border: 1px solid var(--mat-sys-outline-variant);
      padding: 6px 12px;
    }
    app-vista-markdown .markdown th {
      background: var(--mat-sys-surface-container);
    }
    app-vista-markdown .markdown code {
      font-family: 'Cascadia Code', Consolas, monospace;
      font-size: 0.9em;
      padding: 1px 5px;
      border-radius: 4px;
      background: var(--mat-sys-surface-container-high);
    }
    app-vista-markdown .markdown pre code {
      display: block;
      padding: 12px;
      overflow-x: auto;
    }
    app-vista-markdown .markdown blockquote {
      margin: 1em 0;
      padding: 4px 16px;
      border-left: 4px solid var(--mat-sys-primary);
      color: var(--mat-sys-on-surface-variant);
    }
    app-vista-markdown .markdown a {
      color: var(--mat-sys-primary);
    }
    app-vista-markdown .markdown hr {
      border: none;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VistaMarkdown {
  readonly texto = input.required<string>();

  protected readonly html = computed(() => marked.parse(this.texto(), { gfm: true, async: false }));
}
