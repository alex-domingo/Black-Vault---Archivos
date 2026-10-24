import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Actividad, CATEGORIAS_ACTIVIDAD, Fragmento, describirActividad } from '../../../nucleo/modelos/actividad';
import { Sesion } from '../../../nucleo/servicios/sesion';

interface Dia {
  clave: string;
  fecha: string;
  elementos: { actividad: Actividad; frase: Fragmento[]; icono: string }[];
}

const ICONOS = new Map(CATEGORIAS_ACTIVIDAD.map((c) => [c.valor, c.icono]));
const ICONO_ACCION: Record<string, string> = {
  INICIO_SESION_FALLIDO: 'gpp_maybe',
  COMENTARIO_AGREGADO: 'chat',
  COMENTARIO_ELIMINADO: 'chat',
  ARCHIVO_RESTAURADO: 'restore_from_trash',
  CARPETA_RESTAURADA: 'restore_from_trash',
  ARCHIVO_ELIMINADO_DEFINITIVO: 'delete_forever',
  CARPETA_ELIMINADA_DEFINITIVO: 'delete_forever',
  PAPELERA_VACIADA: 'delete_forever',
  ARCHIVO_DESCARGADO: 'download',
  ARCHIVO_EDITADO: 'edit',
  ARCHIVO_SUBIDO: 'upload_file',
  CARPETA_CREADA: 'create_new_folder',
};

/** Historial agrupado por día, con cada acción descrita en una frase. */
@Component({
  selector: 'app-lista-actividad',
  imports: [DatePipe, MatIconModule, MatTooltipModule],
  template: `
    @for (dia of dias(); track dia.clave) {
      <section class="dia" [attr.aria-label]="dia.fecha | date: 'fullDate'">
        <h3>{{ dia.fecha | date: 'fullDate' }}</h3>
        <ol>
          @for (e of dia.elementos; track e.actividad._id) {
            <li class="evento" [class.alerta]="e.actividad.accion === 'INICIO_SESION_FALLIDO'">
              <span class="icono" [attr.data-categoria]="e.actividad.categoria"><mat-icon aria-hidden="true">{{ e.icono }}</mat-icon></span>
              <span class="frase">
                @for (f of e.frase; track $index) {
                  @if (f.resaltado) {
                    <strong>{{ f.texto }}</strong>
                  } @else {
                    {{ f.texto }}
                  }
                }
              </span>
              <span class="hora">
                <time [attr.datetime]="e.actividad.fecha">{{ e.actividad.fecha | date: 'shortTime' }}</time>
                @if (mostrarIp() && e.actividad.ip) {
                  <span class="ip" matTooltip="Dirección IP">{{ e.actividad.ip }}</span>
                }
              </span>
            </li>
          }
        </ol>
      </section>
    }
  `,
  styles: `
    .dia + .dia {
      margin-top: 16px;
    }
    h3 {
      position: sticky;
      top: 0;
      z-index: 1;
      margin: 0;
      padding: 8px 0;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface-variant);
      background: var(--mat-sys-surface);
    }
    h3::first-letter {
      text-transform: uppercase;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .evento {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }
    .evento + .evento {
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .icono {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .icono mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }
    .icono[data-categoria='papelera'] {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .icono[data-categoria='comparticiones'] {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .icono[data-categoria='autenticacion'],
    .icono[data-categoria='usuarios'] {
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
    }
    .alerta .icono {
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
    }
    .frase {
      font: var(--mat-sys-body-medium);
      overflow-wrap: anywhere;
    }
    strong {
      font-weight: 600;
    }
    .hora {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }
    .ip {
      font-family: 'Cascadia Code', Consolas, monospace;
      font-size: 11px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaActividad {
  private readonly sesion = inject(Sesion);

  readonly actividades = input.required<Actividad[]>();
  readonly mostrarIp = input(false);

  protected readonly dias = computed<Dia[]>(() => {
    const yo = this.sesion.usuario()?._id ?? null;
    const dias: Dia[] = [];
    for (const actividad of this.actividades()) {
      // Día en la zona horaria del navegador (la de quien lee).
      const clave = new Date(actividad.fecha).toLocaleDateString('en-CA');
      let dia = dias.at(-1);
      if (!dia || dia.clave !== clave) {
        dia = { clave, fecha: actividad.fecha, elementos: [] };
        dias.push(dia);
      }
      dia.elementos.push({
        actividad,
        frase: describirActividad(actividad, yo),
        icono: ICONO_ACCION[actividad.accion] ?? ICONOS.get(actividad.categoria) ?? 'history',
      });
    }
    return dias;
  });
}
