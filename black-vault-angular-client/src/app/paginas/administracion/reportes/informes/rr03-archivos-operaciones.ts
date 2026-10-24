import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { GraficaBarras } from '../../../../compartido/graficas/grafica-barras';
import { RangoFechas } from '../../../../nucleo/modelos/reportes';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { nombreAccion, nombreEstado } from '../etiquetas';
import { FiltroFechas } from '../filtro-fechas';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-03: archivos con mayor cantidad de operaciones registradas. */
@Component({
  selector: 'app-rr03',
  imports: [DatePipe, MatFormFieldModule, MatSelectModule, GraficaBarras, FiltroFechas, TarjetaReporte],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte codigo="RR-03" titulo="Archivos con más operaciones" descripcion="Según el historial: se incluyen los archivos en la papelera y los ya eliminados definitivamente." [cargando]="r.cargando()" [error]="r.error()" [csv]="csv()">
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
        <app-grafica-barras [datos]="barras()" descripcion="Archivos con más operaciones registradas" />
        <div class="contenedor-tabla">
          <table class="tabla">
            <thead><tr><th>#</th><th>Archivo</th><th>Estado</th><th class="num">Operaciones</th><th>Detalle</th><th>Última</th></tr></thead>
            <tbody>
              @for (a of d; track a._id; let i = $index) {
                <tr>
                  <td class="num">{{ i + 1 }}</td>
                  <td>{{ a.nombre }}<span class="secundario">{{ a.propietario?.nombreCompleto }}</span></td>
                  <td><span class="estado" [class]="a.estado">{{ estado[a.estado] }}</span></td>
                  <td class="num">{{ a.operaciones }}</td>
                  <td><span class="secundario">{{ detalle(a.porAccion) }}</span></td>
                  <td>{{ a.ultima | date: 'mediumDate' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="vacio">Sin operaciones sobre archivos en ese período.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-tarjeta-reporte>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr03ArchivosOperaciones {
  private readonly api = inject(ReportesApi);
  protected readonly rango = signal<RangoFechas>({});
  protected readonly limite = signal(10);
  protected readonly estado = nombreEstado;
  protected readonly r = cargarReporte(computed(() => ({ ...this.rango(), limite: this.limite() })), (c) => this.api.archivosMasOperaciones(c));
  protected readonly barras = computed(() =>
    (this.r.datos() ?? []).map((a) => ({ etiqueta: a.nombre, valores: [a.operaciones], detalle: a.estado === 'activo' ? a.propietario?.nombreCompleto : nombreEstado[a.estado] })),
  );
  protected detalle(porAccion: { accion: string; cantidad: number }[]): string {
    return porAccion.map((p) => `${nombreAccion(p.accion)}: ${p.cantidad}`).join(' · ');
  }
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    return {
      nombre: 'RR-03 archivos con más operaciones',
      encabezados: ['Archivo', 'Propietario', 'Estado', 'Operaciones', 'Detalle', 'Última'],
      filas: d.map((a) => [a.nombre, a.propietario?.nombreUsuario, a.estado, a.operaciones, this.detalle(a.porAccion), a.ultima]),
    };
  });
}
