import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { InformeResumen } from './informes/resumen';
import { Rr01ArchivosPorTipo } from './informes/rr01-archivos-por-tipo';
import { Rr02ArchivosPorFecha } from './informes/rr02-archivos-por-fecha';
import { Rr03ArchivosOperaciones } from './informes/rr03-archivos-operaciones';
import { Rr04UsuariosArchivos } from './informes/rr04-usuarios-archivos';
import { Rr05UsuariosCompartidos } from './informes/rr05-usuarios-compartidos';
import { Rr06ArchivosCompartidos } from './informes/rr06-archivos-compartidos';
import { Rr07ComparticionesUsuario } from './informes/rr07-comparticiones-usuario';
import { Rr09ActividadUsuario } from './informes/rr09-actividad-usuario';
import { Rr10OperacionesTipo } from './informes/rr10-operaciones-tipo';
import { Rr11OperacionesPeriodo } from './informes/rr11-operaciones-periodo';
import { Rr12PrincipalesAcciones } from './informes/rr12-principales-acciones';

interface EntradaMenu {
  clave: string;
  codigo: string;
  titulo: string;
}

const GRUPOS: { titulo: string; icono: string; entradas: EntradaMenu[] }[] = [
  { titulo: 'General', icono: 'dashboard', entradas: [{ clave: 'resumen', codigo: '', titulo: 'Panel general' }] },
  {
    titulo: 'Archivos',
    icono: 'description',
    entradas: [
      { clave: 'rr-01', codigo: 'RR-01', titulo: 'Archivos por tipo' },
      { clave: 'rr-02', codigo: 'RR-02', titulo: 'Archivos por rango de fechas' },
      { clave: 'rr-03', codigo: 'RR-03', titulo: 'Archivos con más operaciones' },
      { clave: 'rr-04', codigo: 'RR-04', titulo: 'Top 10 usuarios con más archivos' },
    ],
  },
  {
    titulo: 'Compartir',
    icono: 'share',
    entradas: [
      { clave: 'rr-05', codigo: 'RR-05', titulo: 'Usuarios que más comparten' },
      { clave: 'rr-06', codigo: 'RR-06', titulo: 'Archivos compartidos con más usuarios' },
      { clave: 'rr-07', codigo: 'RR-07', titulo: 'Compartidos por un usuario' },
      { clave: 'rr-08', codigo: 'RR-08', titulo: 'Recibidos por un usuario' },
    ],
  },
  {
    titulo: 'Actividad',
    icono: 'history',
    entradas: [
      { clave: 'rr-09', codigo: 'RR-09', titulo: 'Actividad de un usuario' },
      { clave: 'rr-10', codigo: 'RR-10', titulo: 'Operaciones por tipo' },
      { clave: 'rr-11', codigo: 'RR-11', titulo: 'Operaciones por período' },
      { clave: 'rr-12', codigo: 'RR-12', titulo: 'Principales acciones' },
    ],
  },
];

/** Módulo de reportes del administrador (RF-15, RF-16): un reporte a la vez, elegido en el menú. */
@Component({
  selector: 'app-reportes',
  imports: [
    RouterLink,
    MatFormFieldModule,
    MatIconModule,
    MatListModule,
    MatSelectModule,
    InformeResumen,
    Rr01ArchivosPorTipo,
    Rr02ArchivosPorFecha,
    Rr03ArchivosOperaciones,
    Rr04UsuariosArchivos,
    Rr05UsuariosCompartidos,
    Rr06ArchivosCompartidos,
    Rr07ComparticionesUsuario,
    Rr09ActividadUsuario,
    Rr10OperacionesTipo,
    Rr11OperacionesPeriodo,
    Rr12PrincipalesAcciones,
  ],
  template: `
    <header class="cabecera-pagina">
      <h1>Reportes</h1>
      <p>Calculados en MongoDB con aggregation pipelines. Cada tabla se puede descargar en CSV.</p>
    </header>

    <mat-form-field class="selector-movil" subscriptSizing="dynamic">
      <mat-label>Reporte</mat-label>
      <mat-select [value]="actual()" (valueChange)="elegir($event)">
        @for (g of grupos; track g.titulo) {
          <mat-optgroup [label]="g.titulo">
            @for (e of g.entradas; track e.clave) {
              <mat-option [value]="e.clave">{{ e.codigo ? e.codigo + ' · ' : '' }}{{ e.titulo }}</mat-option>
            }
          </mat-optgroup>
        }
      </mat-select>
    </mat-form-field>

    <div class="disposicion">
      <nav class="menu" aria-label="Reportes">
        @for (g of grupos; track g.titulo) {
          <h2 class="grupo"><mat-icon aria-hidden="true">{{ g.icono }}</mat-icon>{{ g.titulo }}</h2>
          <mat-nav-list>
            @for (e of g.entradas; track e.clave) {
              <a mat-list-item [routerLink]="[]" [queryParams]="{ r: e.clave }" [activated]="actual() === e.clave" [attr.aria-current]="actual() === e.clave ? 'page' : null">
                <span matListItemTitle>{{ e.titulo }}</span>
                @if (e.codigo) {
                  <span matListItemLine class="codigo">{{ e.codigo }}</span>
                }
              </a>
            }
          </mat-nav-list>
        }
      </nav>

      <div class="contenido">
        @switch (actual()) {
          @case ('rr-01') { <app-rr01 /> }
          @case ('rr-02') { <app-rr02 /> }
          @case ('rr-03') { <app-rr03 /> }
          @case ('rr-04') { <app-rr04 /> }
          @case ('rr-05') { <app-rr05 /> }
          @case ('rr-06') { <app-rr06 /> }
          @case ('rr-07') { <app-rr07 /> }
          @case ('rr-08') { <app-rr07 [recibidos]="true" /> }
          @case ('rr-09') { <app-rr09 /> }
          @case ('rr-10') { <app-rr10 /> }
          @case ('rr-11') { <app-rr11 /> }
          @case ('rr-12') { <app-rr12 /> }
          @default { <app-informe-resumen /> }
        }
      </div>
    </div>
  `,
  styles: `
    .cabecera-pagina {
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 4px;
      font: var(--mat-sys-headline-small);
    }
    .cabecera-pagina p {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .disposicion {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }
    .menu {
      position: sticky;
      top: 16px;
    }
    .grupo {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 12px 16px 0;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .grupo mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }
    .codigo {
      font: var(--mat-sys-label-small);
    }
    .selector-movil {
      display: none;
      width: 100%;
      margin-bottom: 16px;
    }
    @media (max-width: 1099px) {
      .disposicion {
        grid-template-columns: minmax(0, 1fr);
      }
      .menu {
        display: none;
      }
      .selector-movil {
        display: block;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reportes {
  private readonly router = inject(Router);
  protected readonly grupos = GRUPOS;
  /** Parámetro ?r= de la ruta: el reporte abierto. */
  readonly r = input<string>();
  protected readonly actual = computed(() => {
    const clave = this.r() ?? 'resumen';
    return GRUPOS.some((g) => g.entradas.some((e) => e.clave === clave)) ? clave : 'resumen';
  });

  protected elegir(clave: string): void {
    void this.router.navigate([], { queryParams: { r: clave } });
  }
}
