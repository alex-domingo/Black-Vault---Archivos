import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { GraficaBarras } from '../../../../compartido/graficas/grafica-barras';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-05: usuarios con mayor cantidad de recursos compartidos (como propietarios). */
@Component({
  selector: 'app-rr05',
  imports: [MatFormFieldModule, MatSelectModule, GraficaBarras, TarjetaReporte],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte codigo="RR-05" titulo="Usuarios que más comparten" descripcion="Recursos propios que cada usuario compartió (sin contar lo que está en la papelera)." [cargando]="r.cargando()" [error]="r.error()" [csv]="csv()">
      <div filtros class="filtros">
        <mat-form-field class="chico" subscriptSizing="dynamic">
          <mat-label>Mostrar</mat-label>
          <mat-select [value]="limite()" (valueChange)="limite.set($event)">
            @for (n of [5, 10, 20]; track n) {<mat-option [value]="n">Top {{ n }}</mat-option>}
          </mat-select>
        </mat-form-field>
      </div>
      @if (r.datos(); as d) {
        <app-grafica-barras [datos]="barras()" descripcion="Recursos compartidos por usuario" />
        <div class="contenedor-tabla">
          <table class="tabla">
            <thead><tr><th>#</th><th>Usuario</th><th class="num">Recursos</th><th class="num">Archivos</th><th class="num">Carpetas</th><th class="num">Comparticiones</th><th class="num">Personas</th><th>Permisos</th></tr></thead>
            <tbody>
              @for (f of d; track f.usuario?._id; let i = $index) {
                <tr>
                  <td class="num">{{ i + 1 }}</td>
                  <td>{{ f.usuario?.nombreCompleto }}<span class="secundario">{{ f.usuario?.nombreUsuario }}</span></td>
                  <td class="num">{{ f.recursos }}</td>
                  <td class="num">{{ f.archivos }}</td>
                  <td class="num">{{ f.carpetas }}</td>
                  <td class="num">{{ f.comparticiones }}</td>
                  <td class="num">{{ f.destinatarios }}</td>
                  <td><span class="secundario">Lectura {{ f.lectura }} · Comentar {{ f.comentario }} · Edición {{ f.edicion }}</span></td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="vacio">Nadie ha compartido nada todavía.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-tarjeta-reporte>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr05UsuariosCompartidos {
  private readonly api = inject(ReportesApi);
  protected readonly limite = signal(10);
  protected readonly r = cargarReporte(computed(() => ({ limite: this.limite() })), (c) => this.api.usuariosMasCompartidos(c));
  protected readonly barras = computed(() =>
    (this.r.datos() ?? []).map((f) => ({ etiqueta: f.usuario?.nombreCompleto ?? '—', valores: [f.recursos], detalle: `con ${f.destinatarios} persona(s)` })),
  );
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    return {
      nombre: 'RR-05 usuarios que más comparten',
      encabezados: ['Usuario', 'Nombre', 'Recursos', 'Archivos', 'Carpetas', 'Comparticiones', 'Personas', 'Lectura', 'Comentar', 'Edición'],
      filas: d.map((f) => [f.usuario?.nombreUsuario, f.usuario?.nombreCompleto, f.recursos, f.archivos, f.carpetas, f.comparticiones, f.destinatarios, f.lectura, f.comentario, f.edicion]),
    };
  });
}
