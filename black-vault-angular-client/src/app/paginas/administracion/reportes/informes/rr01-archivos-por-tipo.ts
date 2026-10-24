import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BytesPipe } from '../../../../compartido/pipes/bytes.pipe';
import { GraficaBarras } from '../../../../compartido/graficas/grafica-barras';
import { RangoFechas } from '../../../../nucleo/modelos/reportes';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { formatoBytes, nombreCategoria, nombreTipo } from '../etiquetas';
import { FiltroFechas } from '../filtro-fechas';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-01: cantidad de archivos agrupados por tipo (y, como extra, por categoría). */
@Component({
  selector: 'app-rr01',
  imports: [DatePipe, MatSlideToggleModule, BytesPipe, GraficaBarras, FiltroFechas, TarjetaReporte],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte codigo="RR-01" titulo="Archivos por tipo" descripcion="Cantidad de archivos .txt y .md, con el espacio que ocupan. Por fecha de carga." [cargando]="r.cargando()" [error]="r.error()" [csv]="csv()">
      <div filtros class="filtros">
        <app-filtro-fechas [(rango)]="rango" />
        <mat-slide-toggle [checked]="incluirPapelera()" (change)="incluirPapelera.set($event.checked)">Incluir la papelera</mat-slide-toggle>
      </div>
      @if (r.datos(); as d) {
        <div class="indicadores">
          <div class="indicador"><span class="valor">{{ d.total.cantidad }}</span><span class="nombre">archivos</span></div>
          <div class="indicador"><span class="valor">{{ d.total.bytes | bytes }}</span><span class="nombre">en total</span></div>
        </div>
        <div class="dos-columnas">
          <div>
            <h3 class="subtitulo">Por tipo</h3>
            <app-grafica-barras [datos]="porTipo()" [descripcion]="'Archivos por tipo: ' + resumenTipos()" />
          </div>
          <div>
            <h3 class="subtitulo">Por categoría</h3>
            <app-grafica-barras [datos]="porCategoria()" descripcion="Archivos por categoría" />
          </div>
        </div>
        <div class="contenedor-tabla">
          <table class="tabla">
            <thead><tr><th>Tipo</th><th class="num">Archivos</th><th class="num">Espacio</th><th class="num">Tamaño promedio</th>@if (incluirPapelera()) {<th class="num">En la papelera</th>}<th>Última carga</th></tr></thead>
            <tbody>
              @for (t of d.porTipo; track t.tipo) {
                <tr>
                  <td>{{ tipo(t.tipo) }}</td>
                  <td class="num">{{ t.cantidad }}</td>
                  <td class="num">{{ t.bytes | bytes }}</td>
                  <td class="num">{{ t.promedioBytes | bytes }}</td>
                  @if (incluirPapelera()) {<td class="num">{{ t.enPapelera }}</td>}
                  <td>{{ t.ultimaCarga | date: 'medium' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="vacio">No hay archivos en ese período.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-tarjeta-reporte>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr01ArchivosPorTipo {
  private readonly api = inject(ReportesApi);
  protected readonly rango = signal<RangoFechas>({});
  protected readonly incluirPapelera = signal(false);
  protected readonly tipo = nombreTipo;
  protected readonly r = cargarReporte(
    computed(() => ({ ...this.rango(), incluirPapelera: this.incluirPapelera() })),
    (c) => this.api.archivosPorTipo(c),
  );
  protected readonly porTipo = computed(() => (this.r.datos()?.porTipo ?? []).map((t) => ({ etiqueta: nombreTipo(t.tipo), valores: [t.cantidad], detalle: formatoBytes(t.bytes) })));
  protected readonly porCategoria = computed(() =>
    (this.r.datos()?.porCategoria ?? []).map((c) => ({ etiqueta: nombreCategoria(c.categoria), valores: [c.cantidad], detalle: formatoBytes(c.bytes) })),
  );
  protected readonly resumenTipos = computed(() => this.porTipo().map((t) => `${t.etiqueta} ${t.valores[0]}`).join(', '));
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    return {
      nombre: 'RR-01 archivos por tipo',
      encabezados: ['Tipo', 'Archivos', 'Bytes', 'Promedio (bytes)', 'En la papelera', 'Última carga'],
      filas: d.porTipo.map((t) => [t.tipo, t.cantidad, t.bytes, t.promedioBytes, t.enPapelera, t.ultimaCarga]),
    };
  });
}
