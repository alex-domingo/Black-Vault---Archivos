import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { of } from 'rxjs';
import { GraficaBarras } from '../../../../compartido/graficas/grafica-barras';
import { ListaActividad } from '../../../../compartido/componentes/lista-actividad/lista-actividad';
import { proveerPaginadorEs } from '../../../../nucleo/i18n/paginador-es';
import { CATEGORIAS_ACTIVIDAD, CategoriaActividad } from '../../../../nucleo/modelos/actividad';
import { RangoFechas } from '../../../../nucleo/modelos/reportes';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { nombreAccion, nombreCategoriaActividad } from '../etiquetas';
import { FiltroFechas } from '../filtro-fechas';
import { SelectorUsuario } from '../selector-usuario';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-09: historial de actividad de un usuario dentro de un rango de fechas. */
@Component({
  selector: 'app-rr09',
  imports: [MatFormFieldModule, MatPaginatorModule, MatSelectModule, GraficaBarras, ListaActividad, FiltroFechas, SelectorUsuario, TarjetaReporte],
  providers: [proveerPaginadorEs],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte codigo="RR-09" titulo="Actividad de un usuario" descripcion="Todo lo que hizo el usuario elegido dentro del período, del más reciente al más antiguo." [cargando]="r.cargando()" [error]="r.error()" [csv]="csv()">
      <div filtros class="filtros">
        <app-selector-usuario [(usuarioId)]="usuarioId" />
        <app-filtro-fechas [(rango)]="rango" />
        <mat-form-field class="chico" subscriptSizing="dynamic">
          <mat-label>Categoría</mat-label>
          <mat-select [value]="categoria()" (valueChange)="categoria.set($event)">
            <mat-option value="">Todas</mat-option>
            @for (c of categorias; track c.valor) {<mat-option [value]="c.valor">{{ c.etiqueta }}</mat-option>}
          </mat-select>
        </mat-form-field>
      </div>
      @if (r.datos(); as d) {
        <div class="indicadores">
          <div class="indicador"><span class="valor">{{ d.total }}</span><span class="nombre">operaciones{{ categoria() ? ' en esta categoría' : '' }}</span></div>
        </div>
        <h3 class="subtitulo">Por categoría</h3>
        <app-grafica-barras [datos]="porCategoria()" [descripcion]="'Actividad de ' + d.usuario.nombreCompleto + ' por categoría'" />
        <h3 class="subtitulo detalle-titulo">Detalle</h3>
        @if (d.datos.length) {
          <app-lista-actividad [actividades]="d.datos" [mostrarIp]="true" />
          <mat-paginator [length]="d.total" [pageIndex]="pagina()" [pageSize]="limite()" [pageSizeOptions]="[10, 20, 50]" (page)="cambiarPagina($event)" aria-label="Páginas" />
        } @else {
          <p class="vacio">Sin actividad en ese período.</p>
        }
      }
    </app-tarjeta-reporte>
  `,
  styles: `
    .detalle-titulo {
      margin-top: 24px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr09ActividadUsuario {
  private readonly api = inject(ReportesApi);
  protected readonly categorias = CATEGORIAS_ACTIVIDAD;
  protected readonly usuarioId = signal<string | null>(null);
  protected readonly rango = signal<RangoFechas>({});
  protected readonly categoria = signal<CategoriaActividad | ''>('');
  protected readonly pagina = signal(0);
  protected readonly limite = signal(20);

  constructor() {
    effect(() => {
      this.usuarioId();
      this.rango();
      this.categoria();
      untracked(() => this.pagina.set(0));
    });
  }

  protected readonly r = cargarReporte(
    computed(() => ({ usuarioId: this.usuarioId(), ...this.rango(), categoria: this.categoria(), pagina: this.pagina() + 1, limite: this.limite() })),
    ({ usuarioId, ...p }) => (usuarioId ? this.api.actividadUsuario(usuarioId, p) : of(undefined)),
  );
  protected readonly porCategoria = computed(() =>
    (this.r.datos()?.porCategoria ?? []).map((c) => ({ etiqueta: nombreCategoriaActividad(c.categoria), valores: [c.cantidad] })),
  );
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    return {
      nombre: `RR-09 actividad de ${d.usuario.nombreUsuario}`,
      encabezados: ['Fecha', 'Acción', 'Categoría', 'Recurso', 'Usuario afectado', 'IP'],
      filas: d.datos.map((a) => [a.fecha, nombreAccion(a.accion), a.categoria, a.recurso?.nombre, a.usuarioAfectado?.nombreUsuario, a.ip]),
    };
  });

  protected cambiarPagina(e: PageEvent): void {
    this.limite.set(e.pageSize);
    this.pagina.set(e.pageIndex);
  }
}
