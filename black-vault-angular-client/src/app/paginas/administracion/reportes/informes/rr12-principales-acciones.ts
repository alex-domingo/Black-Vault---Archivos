import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { GraficaBarras } from '../../../../compartido/graficas/grafica-barras';
import { RangoFechas } from '../../../../nucleo/modelos/reportes';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { nombreAccion, nombreCategoriaActividad } from '../etiquetas';
import { FiltroFechas } from '../filtro-fechas';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-12: principales acciones realizadas (ranking con % del total y quién más las realiza). */
@Component({
  selector: 'app-rr12',
  imports: [DatePipe, MatFormFieldModule, MatSelectModule, GraficaBarras, FiltroFechas, TarjetaReporte],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte codigo="RR-12" titulo="Principales acciones" descripcion="Las acciones más frecuentes: su peso en el total, cuántas personas las realizan y quién más." [cargando]="r.cargando()" [error]="r.error()" [csv]="csv()">
      <div filtros class="filtros">
        <app-filtro-fechas [(rango)]="rango" />
        <mat-form-field class="chico" subscriptSizing="dynamic">
          <mat-label>Mostrar</mat-label>
          <mat-select [value]="limite()" (valueChange)="limite.set($event)">
            @for (n of [5, 10, 20]; track n) {<mat-option [value]="n">Top {{ n }}</mat-option>}
          </mat-select>
        </mat-form-field>
      </div>
      @if (r.datos(); as d) {
        <app-grafica-barras [datos]="barras()" [formato]="formatoPorcentaje" descripcion="Porcentaje del total de operaciones por acción" />
        <div class="contenedor-tabla">
          <table class="tabla">
            <thead><tr><th>#</th><th>Acción</th><th class="num">Cantidad</th><th class="num">% del total</th><th class="num">Usuarios</th><th>Quién más la realiza</th><th>Última vez</th></tr></thead>
            <tbody>
              @for (a of d; track a.accion; let i = $index) {
                <tr>
                  <td class="num">{{ i + 1 }}</td>
                  <td>{{ accion(a.accion) }}<span class="secundario">{{ categoria(a.categoria) }}</span></td>
                  <td class="num">{{ a.cantidad }}</td>
                  <td class="num">{{ a.porcentaje }} %</td>
                  <td class="num">{{ a.usuariosDistintos }}</td>
                  <td>{{ a.usuarioPrincipal.nombreCompleto }}<span class="secundario">{{ a.usuarioPrincipal.cantidad }} {{ a.usuarioPrincipal.cantidad === 1 ? 'vez' : 'veces' }}</span></td>
                  <td>{{ a.ultima | date: 'medium' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="vacio">Sin operaciones en ese período.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-tarjeta-reporte>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr12PrincipalesAcciones {
  private readonly api = inject(ReportesApi);
  protected readonly rango = signal<RangoFechas>({});
  protected readonly limite = signal(10);
  protected readonly accion = nombreAccion;
  protected readonly categoria = nombreCategoriaActividad;
  protected readonly formatoPorcentaje = (n: number) => `${n.toFixed(1)} %`;
  protected readonly r = cargarReporte(computed(() => ({ ...this.rango(), limite: this.limite() })), (c) => this.api.principalesAcciones(c));
  protected readonly barras = computed(() =>
    (this.r.datos() ?? []).map((a) => ({ etiqueta: nombreAccion(a.accion), valores: [a.porcentaje], detalle: `${a.cantidad} · ${a.usuariosDistintos} usuario(s)` })),
  );
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    return {
      nombre: 'RR-12 principales acciones',
      encabezados: ['Acción', 'Código', 'Categoría', 'Cantidad', '% del total', 'Usuarios distintos', 'Quién más la realiza', 'Veces', 'Última vez'],
      filas: d.map((a) => [nombreAccion(a.accion), a.accion, a.categoria, a.cantidad, a.porcentaje, a.usuariosDistintos, a.usuarioPrincipal.nombreUsuario, a.usuarioPrincipal.cantidad, a.ultima]),
    };
  });
}
