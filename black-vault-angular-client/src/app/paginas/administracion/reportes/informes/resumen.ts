import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BytesPipe } from '../../../../compartido/pipes/bytes.pipe';
import { GraficaColumnas } from '../../../../compartido/graficas/grafica-columnas';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { etiquetasPeriodo } from '../fechas';
import { TarjetaReporte } from '../tarjeta-reporte';

/** Panel resumen del administrador: el estado general del sistema. */
@Component({
  selector: 'app-informe-resumen',
  imports: [MatIconModule, BytesPipe, GraficaColumnas, TarjetaReporte],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte codigo="Resumen" titulo="Panel general" descripcion="Estado actual del sistema y actividad de los últimos 30 días." [cargando]="r.cargando()" [error]="r.error()">
      @if (r.datos(); as d) {
        <div class="indicadores">
          <div class="indicador"><span class="valor">{{ d.usuarios.activos }}</span><span class="nombre">usuarios activos ({{ d.usuarios.inactivos }} inactivos)</span></div>
          <div class="indicador"><span class="valor">{{ d.archivos.activos }}</span><span class="nombre">archivos ({{ d.archivos.enPapelera }} en la papelera)</span></div>
          <div class="indicador"><span class="valor">{{ d.carpetas.activas }}</span><span class="nombre">carpetas</span></div>
          <div class="indicador"><span class="valor">{{ d.archivos.bytes | bytes }}</span><span class="nombre">almacenados ({{ d.archivos.bytesPapelera | bytes }} en la papelera)</span></div>
          <div class="indicador"><span class="valor">{{ d.comparticiones.total }}</span><span class="nombre">comparticiones ({{ d.comparticiones.archivos }} archivos, {{ d.comparticiones.carpetas }} carpetas)</span></div>
          <div class="indicador"><span class="valor">{{ d.archivos.comentarios }}</span><span class="nombre">comentarios</span></div>
          <div class="indicador"><span class="valor">{{ d.actividad.total }}</span><span class="nombre">operaciones registradas</span></div>
        </div>
        <h3 class="subtitulo">Operaciones por día (últimos 30 días): {{ d.actividad.ultimos30Total }}</h3>
        <app-grafica-columnas [datos]="serie()" [descripcion]="'Operaciones por día en los últimos 30 días: ' + d.actividad.ultimos30Total + ' en total'" />
      }
    </app-tarjeta-reporte>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformeResumen {
  private readonly api = inject(ReportesApi);
  protected readonly r = cargarReporte(signal(0), () => this.api.resumen());
  protected readonly serie = computed(() =>
    (this.r.datos()?.actividad.ultimos30Dias ?? []).map((p) => ({ ...etiquetasPeriodo(p.periodo, 'dia'), valor: p.cantidad })),
  );
}
