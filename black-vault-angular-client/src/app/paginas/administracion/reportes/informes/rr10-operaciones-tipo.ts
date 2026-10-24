import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GraficaBarras } from '../../../../compartido/graficas/grafica-barras';
import { RangoFechas } from '../../../../nucleo/modelos/reportes';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { nombreAccion, nombreCategoriaActividad } from '../etiquetas';
import { FiltroFechas } from '../filtro-fechas';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-10: cantidad de operaciones agrupadas por tipo (cada acción dentro de su categoría). */
@Component({
  selector: 'app-rr10',
  imports: [GraficaBarras, FiltroFechas, TarjetaReporte],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte codigo="RR-10" titulo="Operaciones por tipo" descripcion="Distribución completa de las operaciones registradas, agrupadas por categoría." [cargando]="r.cargando()" [error]="r.error()" [csv]="csv()">
      <div filtros class="filtros"><app-filtro-fechas [(rango)]="rango" /></div>
      @if (r.datos(); as d) {
        <div class="indicadores">
          <div class="indicador"><span class="valor">{{ d.total }}</span><span class="nombre">operaciones</span></div>
          <div class="indicador"><span class="valor">{{ tipos() }}</span><span class="nombre">tipos de operación distintos</span></div>
        </div>
        <h3 class="subtitulo">Por categoría</h3>
        <app-grafica-barras [datos]="porCategoria()" descripcion="Operaciones por categoría" />
        <div class="contenedor-tabla">
          <table class="tabla">
            <thead><tr><th>Categoría</th><th>Operación</th><th class="num">Cantidad</th><th class="num">% de la categoría</th></tr></thead>
            <tbody>
              @for (c of d.categorias; track c.categoria) {
                @for (a of c.acciones; track a.accion; let primera = $first) {
                  <tr>
                    <td>@if (primera) {<strong>{{ categoria(c.categoria) }}</strong> <span class="secundario">{{ c.total }} en total</span>}</td>
                    <td>{{ accion(a.accion) }}</td>
                    <td class="num">{{ a.cantidad }}</td>
                    <td class="num">{{ ((a.cantidad / c.total) * 100).toFixed(1) }} %</td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="4" class="vacio">Sin operaciones en ese período.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-tarjeta-reporte>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr10OperacionesTipo {
  private readonly api = inject(ReportesApi);
  protected readonly rango = signal<RangoFechas>({});
  protected readonly accion = nombreAccion;
  protected readonly categoria = nombreCategoriaActividad;
  protected readonly r = cargarReporte(computed(() => this.rango()), (c) => this.api.operacionesPorTipo(c));
  protected readonly porCategoria = computed(() =>
    (this.r.datos()?.categorias ?? []).map((c) => ({ etiqueta: nombreCategoriaActividad(c.categoria), valores: [c.total], detalle: `${c.acciones.length} tipo(s)` })),
  );
  protected readonly tipos = computed(() => (this.r.datos()?.categorias ?? []).reduce((s, c) => s + c.acciones.length, 0));
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    return {
      nombre: 'RR-10 operaciones por tipo',
      encabezados: ['Categoría', 'Operación', 'Código', 'Cantidad'],
      filas: d.categorias.flatMap((c) => c.acciones.map((a) => [nombreCategoriaActividad(c.categoria), nombreAccion(a.accion), a.accion, a.cantidad])),
    };
  });
}
