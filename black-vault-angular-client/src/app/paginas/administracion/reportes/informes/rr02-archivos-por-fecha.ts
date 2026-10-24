import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { BytesPipe } from '../../../../compartido/pipes/bytes.pipe';
import { GraficaColumnas } from '../../../../compartido/graficas/grafica-columnas';
import { proveerPaginadorEs } from '../../../../nucleo/i18n/paginador-es';
import { Extension } from '../../../../nucleo/modelos/documentos';
import { RangoFechas } from '../../../../nucleo/modelos/reportes';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { nombreCategoria } from '../etiquetas';
import { etiquetasPeriodo } from '../fechas';
import { FiltroFechas } from '../filtro-fechas';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-02: archivos almacenados dentro de un rango de fechas. */
@Component({
  selector: 'app-rr02',
  imports: [DatePipe, RouterLink, MatFormFieldModule, MatPaginatorModule, MatSelectModule, MatSlideToggleModule, BytesPipe, GraficaColumnas, FiltroFechas, TarjetaReporte],
  providers: [proveerPaginadorEs],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte codigo="RR-02" titulo="Archivos por rango de fechas" descripcion="Archivos cargados dentro del período elegido, del más reciente al más antiguo." [cargando]="r.cargando()" [error]="r.error()" [csv]="csv()">
      <div filtros class="filtros">
        <app-filtro-fechas [(rango)]="rango" inicial="180" />
        <mat-form-field class="chico" subscriptSizing="dynamic">
          <mat-label>Tipo</mat-label>
          <mat-select [value]="tipo()" (valueChange)="tipo.set($event)">
            <mat-option value="">Todos</mat-option>
            <mat-option value="md">.md</mat-option>
            <mat-option value="txt">.txt</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-slide-toggle [checked]="incluirPapelera()" (change)="incluirPapelera.set($event.checked)">Incluir la papelera</mat-slide-toggle>
      </div>
      @if (r.datos(); as d) {
        <div class="indicadores">
          <div class="indicador"><span class="valor">{{ d.total }}</span><span class="nombre">archivos en el período</span></div>
          <div class="indicador"><span class="valor">{{ d.bytes | bytes }}</span><span class="nombre">en total</span></div>
        </div>
        <h3 class="subtitulo">Cargas por {{ unidades[d.unidadSerie] }}</h3>
        <app-grafica-columnas [datos]="serie()" [descripcion]="'Archivos cargados por ' + unidades[d.unidadSerie] + ': ' + d.total + ' en total'" />
        <div class="contenedor-tabla">
          <table class="tabla">
            <thead><tr><th>Archivo</th><th>Propietario</th><th>Categoría</th><th class="num">Tamaño</th><th>Cargado</th></tr></thead>
            <tbody>
              @for (a of d.datos; track a._id) {
                <tr>
                  <td>
                    @if (a.enPapelera) {
                      {{ a.nombre }}
                    } @else {
                      <a [routerLink]="['/archivo', a._id]">{{ a.nombre }}</a>
                    }
                    <span class="secundario">{{ a.carpeta ?? 'Raíz' }}{{ a.enPapelera ? ' · en la papelera' : '' }}</span>
                  </td>
                  <td>{{ a.propietario?.nombreCompleto ?? '—' }}</td>
                  <td>{{ categoria(a.categoria) }}</td>
                  <td class="num">{{ a.bytes | bytes }}</td>
                  <td>{{ a.creadoEn | date: 'medium' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="vacio">No se cargaron archivos en ese período.</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (d.total > 0) {
          <mat-paginator [length]="d.total" [pageIndex]="pagina()" [pageSize]="limite()" [pageSizeOptions]="[10, 20, 50]" (page)="cambiarPagina($event)" aria-label="Páginas" />
        }
      }
    </app-tarjeta-reporte>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr02ArchivosPorFecha {
  private readonly api = inject(ReportesApi);
  protected readonly rango = signal<RangoFechas>({});
  protected readonly tipo = signal<Extension | ''>('');
  protected readonly incluirPapelera = signal(false);
  protected readonly pagina = signal(0);
  protected readonly limite = signal(10);
  protected readonly categoria = nombreCategoria;

  constructor() {
    effect(() => {
      this.rango();
      this.tipo();
      this.incluirPapelera();
      untracked(() => this.pagina.set(0));
    });
  }

  protected readonly r = cargarReporte(
    computed(() => ({ ...this.rango(), tipo: this.tipo(), incluirPapelera: this.incluirPapelera(), pagina: this.pagina() + 1, limite: this.limite() })),
    (c) => this.api.archivosPorFecha(c),
  );
  protected readonly unidades = { dia: 'día', semana: 'semana', mes: 'mes' };
  protected readonly serie = computed(() => {
    const d = this.r.datos();
    return (d?.serie ?? []).map((p) => ({ ...etiquetasPeriodo(p.periodo, d!.unidadSerie), valor: p.cantidad }));
  });
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    return {
      nombre: 'RR-02 archivos por rango de fechas',
      encabezados: ['Archivo', 'Carpeta', 'Propietario', 'Categoría', 'Bytes', 'Cargado', 'En la papelera'],
      filas: d.datos.map((a) => [a.nombre, a.carpeta ?? 'Raíz', a.propietario?.nombreUsuario, a.categoria, a.bytes, a.creadoEn, a.enPapelera ? 'sí' : 'no']),
    };
  });

  protected cambiarPagina(e: PageEvent): void {
    this.limite.set(e.pageSize);
    this.pagina.set(e.pageIndex);
  }
}
