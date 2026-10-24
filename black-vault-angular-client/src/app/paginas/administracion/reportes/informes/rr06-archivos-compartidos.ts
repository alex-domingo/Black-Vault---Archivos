import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { GraficaBarras, SerieBarras } from '../../../../compartido/graficas/grafica-barras';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-06: archivos compartidos con mayor cantidad de usuarios (directo y efectivo). */
@Component({
  selector: 'app-rr06',
  imports: [MatFormFieldModule, MatSelectModule, GraficaBarras, TarjetaReporte],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte
      codigo="RR-06"
      titulo="Archivos compartidos con más usuarios"
      descripcion="Directo: se compartió el archivo. Heredado: se compartió una carpeta que lo contiene. El total es el acceso efectivo, sin repetir personas."
      [cargando]="r.cargando()"
      [error]="r.error()"
      [csv]="csv()"
    >
      <div filtros class="filtros">
        <mat-form-field class="chico" subscriptSizing="dynamic">
          <mat-label>Mostrar</mat-label>
          <mat-select [value]="limite()" (valueChange)="limite.set($event)">
            @for (n of [5, 10, 20]; track n) {<mat-option [value]="n">Top {{ n }}</mat-option>}
          </mat-select>
        </mat-form-field>
      </div>
      @if (r.datos(); as d) {
        <app-grafica-barras [datos]="barras()" [series]="series" descripcion="Personas con acceso a cada archivo, directo y heredado" />
        <div class="contenedor-tabla">
          <table class="tabla">
            <thead><tr><th>#</th><th>Archivo</th><th>Propietario</th><th class="num">Directo</th><th class="num">Solo heredado</th><th class="num">Acceso efectivo</th></tr></thead>
            <tbody>
              @for (a of d; track a._id; let i = $index) {
                <tr>
                  <td class="num">{{ i + 1 }}</td>
                  <td>{{ a.nombre }}<span class="secundario">{{ a.carpeta ?? 'Raíz' }}</span></td>
                  <td>{{ a.propietario?.nombreCompleto }}</td>
                  <td class="num">{{ a.usuariosDirectos }}</td>
                  <td class="num">{{ a.heredados }}</td>
                  <td class="num">{{ a.usuariosEfectivos }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="vacio">No hay archivos compartidos.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-tarjeta-reporte>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr06ArchivosCompartidos {
  private readonly api = inject(ReportesApi);
  protected readonly limite = signal(10);
  protected readonly series: SerieBarras[] = [{ nombre: 'Directo' }, { nombre: 'Heredado de una carpeta', color: 'terciario' }];
  protected readonly r = cargarReporte(computed(() => ({ limite: this.limite() })), (c) => this.api.archivosMasCompartidos(c));
  protected readonly barras = computed(() =>
    (this.r.datos() ?? []).map((a) => ({ etiqueta: a.nombre, valores: [a.usuariosDirectos, a.heredados], detalle: a.propietario?.nombreCompleto })),
  );
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    return {
      nombre: 'RR-06 archivos compartidos con más usuarios',
      encabezados: ['Archivo', 'Carpeta', 'Propietario', 'Directo', 'Solo heredado', 'Acceso efectivo'],
      filas: d.map((a) => [a.nombre, a.carpeta ?? 'Raíz', a.propietario?.nombreUsuario, a.usuariosDirectos, a.heredados, a.usuariosEfectivos]),
    };
  });
}
