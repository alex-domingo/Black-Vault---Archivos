import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { GraficaColumnas } from '../../../../compartido/graficas/grafica-columnas';
import { CATEGORIAS_ACTIVIDAD, CategoriaActividad } from '../../../../nucleo/modelos/actividad';
import { RangoFechas, UnidadPeriodo } from '../../../../nucleo/modelos/reportes';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { nombreCategoriaActividad } from '../etiquetas';
import { etiquetasPeriodo } from '../fechas';
import { FiltroFechas } from '../filtro-fechas';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-11: cantidad de operaciones agrupadas por período (día, semana o mes). */
@Component({
  selector: 'app-rr11',
  imports: [MatButtonToggleModule, MatFormFieldModule, MatSelectModule, GraficaColumnas, FiltroFechas, TarjetaReporte],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte
      codigo="RR-11"
      titulo="Operaciones por período"
      descripcion="Los períodos sin actividad aparecen en cero. Las semanas empiezan el lunes; todo en hora de Guatemala."
      [cargando]="r.cargando()"
      [error]="r.error()"
      [csv]="csv()"
    >
      <div filtros class="filtros">
        <mat-button-toggle-group [value]="unidad()" (change)="unidad.set($event.value)" aria-label="Agrupar por" hideSingleSelectionIndicator>
          <mat-button-toggle value="dia">Día</mat-button-toggle>
          <mat-button-toggle value="semana">Semana</mat-button-toggle>
          <mat-button-toggle value="mes">Mes</mat-button-toggle>
        </mat-button-toggle-group>
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
          <div class="indicador"><span class="valor">{{ d.total }}</span><span class="nombre">operaciones</span></div>
          <div class="indicador"><span class="valor">{{ d.serie.length }}</span><span class="nombre">{{ nombreUnidad[d.unidad] }}</span></div>
          <div class="indicador"><span class="valor">{{ promedio() }}</span><span class="nombre">promedio por {{ unidadSingular[d.unidad] }}</span></div>
        </div>
        <app-grafica-columnas [datos]="columnas()" [alto]="220" [descripcion]="'Operaciones por ' + unidadSingular[d.unidad] + ': ' + d.total + ' en total'" />
        <div class="contenedor-tabla">
          <table class="tabla">
            <thead><tr><th>Período</th><th class="num">Operaciones</th><th>Por categoría</th></tr></thead>
            <tbody>
              @for (p of filas(); track p.periodo) {
                <tr>
                  <td>{{ p.etiqueta }}</td>
                  <td class="num">{{ p.cantidad }}</td>
                  <td><span class="secundario">{{ p.detalle }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-tarjeta-reporte>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr11OperacionesPeriodo {
  private readonly api = inject(ReportesApi);
  protected readonly categorias = CATEGORIAS_ACTIVIDAD;
  protected readonly unidad = signal<UnidadPeriodo>('mes');
  protected readonly rango = signal<RangoFechas>({});
  protected readonly categoria = signal<CategoriaActividad | ''>('');
  protected readonly nombreUnidad: Record<UnidadPeriodo, string> = { dia: 'días', semana: 'semanas', mes: 'meses' };
  protected readonly unidadSingular: Record<UnidadPeriodo, string> = { dia: 'día', semana: 'semana', mes: 'mes' };
  protected readonly r = cargarReporte(
    computed(() => ({ unidad: this.unidad(), ...this.rango(), categoria: this.categoria() })),
    (c) => this.api.operacionesPorPeriodo(c),
  );
  protected readonly filas = computed(() => {
    const d = this.r.datos();
    if (!d) return [];
    return d.serie.map((p) => ({
      ...p,
      ...etiquetasPeriodo(p.periodo, d.unidad),
      detalle: p.porCategoria.map((c) => `${nombreCategoriaActividad(c.categoria)} ${c.cantidad}`).join(' · '),
    }));
  });
  protected readonly columnas = computed(() => this.filas().map((p) => ({ etiqueta: p.etiqueta, corta: p.corta, valor: p.cantidad })));
  protected readonly promedio = computed(() => {
    const d = this.r.datos();
    return d && d.serie.length ? (d.total / d.serie.length).toFixed(1) : '0';
  });
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    return {
      nombre: `RR-11 operaciones por ${this.unidadSingular[d.unidad]}`,
      encabezados: ['Período', 'Inicio', 'Operaciones', 'Por categoría'],
      filas: this.filas().map((p) => [p.etiqueta, p.periodo, p.cantidad, p.detalle]),
    };
  });
}
