import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { BytesPipe } from '../../../../compartido/pipes/bytes.pipe';
import { GraficaBarras, SerieBarras } from '../../../../compartido/graficas/grafica-barras';
import { Extension } from '../../../../nucleo/modelos/documentos';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { formatoBytes } from '../etiquetas';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-04: Top 10 de usuarios con más archivos almacenados. */
@Component({
  selector: 'app-rr04',
  imports: [MatFormFieldModule, MatSelectModule, BytesPipe, GraficaBarras, TarjetaReporte],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte codigo="RR-04" titulo="Top 10 usuarios con más archivos" descripcion="Ordenado por archivos activos; lo que está en la papelera se muestra aparte." [cargando]="r.cargando()" [error]="r.error()" [csv]="csv()">
      <div filtros class="filtros">
        <mat-form-field class="chico" subscriptSizing="dynamic">
          <mat-label>Tipo</mat-label>
          <mat-select [value]="tipo()" (valueChange)="tipo.set($event)">
            <mat-option value="">Todos</mat-option>
            <mat-option value="md">.md</mat-option>
            <mat-option value="txt">.txt</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
      @if (r.datos(); as d) {
        <app-grafica-barras [datos]="barras()" [series]="series" descripcion="Top 10 usuarios por cantidad de archivos" />
        <div class="contenedor-tabla">
          <table class="tabla">
            <thead><tr><th>#</th><th>Usuario</th><th class="num">Activos</th><th class="num">.md</th><th class="num">.txt</th><th class="num">En la papelera</th><th class="num">Espacio</th></tr></thead>
            <tbody>
              @for (f of d; track f.usuario?._id; let i = $index) {
                <tr>
                  <td class="num">{{ i + 1 }}</td>
                  <td>{{ f.usuario?.nombreCompleto }}<span class="secundario">{{ f.usuario?.nombreUsuario }}{{ f.usuario?.activo === false ? ' · inactivo' : '' }}</span></td>
                  <td class="num">{{ f.activos }}</td>
                  <td class="num">{{ f.md }}</td>
                  <td class="num">{{ f.txt }}</td>
                  <td class="num">{{ f.enPapelera }}</td>
                  <td class="num">{{ f.bytes | bytes }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="vacio">Nadie tiene archivos todavía.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-tarjeta-reporte>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr04UsuariosArchivos {
  private readonly api = inject(ReportesApi);
  protected readonly tipo = signal<Extension | ''>('');
  protected readonly series: SerieBarras[] = [{ nombre: 'Activos' }, { nombre: 'En la papelera', color: 'neutro' }];
  protected readonly r = cargarReporte(computed(() => ({ limite: 10, tipo: this.tipo() })), (c) => this.api.usuariosMasArchivos(c));
  protected readonly barras = computed(() =>
    (this.r.datos() ?? []).map((f) => ({ etiqueta: f.usuario?.nombreCompleto ?? '—', valores: [f.activos, f.enPapelera], detalle: formatoBytes(f.bytes) })),
  );
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    return {
      nombre: 'RR-04 usuarios con más archivos',
      encabezados: ['Usuario', 'Nombre', 'Activos', '.md', '.txt', 'En la papelera', 'Bytes'],
      filas: d.map((f) => [f.usuario?.nombreUsuario, f.usuario?.nombreCompleto, f.activos, f.md, f.txt, f.enPapelera, f.bytes]),
    };
  });
}
