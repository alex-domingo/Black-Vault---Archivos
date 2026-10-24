import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { of } from 'rxjs';
import { IconoArchivo } from '../../../../compartido/componentes/icono-archivo/icono-archivo';
import { proveerPaginadorEs } from '../../../../nucleo/i18n/paginador-es';
import { TipoRecurso } from '../../../../nucleo/modelos/comparticiones';
import { ReportesApi } from '../../../../nucleo/servicios/reportes-api';
import { cargarReporte } from '../carga';
import { nombreEstado, nombrePermiso } from '../etiquetas';
import { SelectorUsuario } from '../selector-usuario';
import { TarjetaReporte } from '../tarjeta-reporte';

/** RR-07 (compartidos por un usuario) y RR-08 (recibidos por un usuario). */
@Component({
  selector: 'app-rr07',
  imports: [DatePipe, MatFormFieldModule, MatIconModule, MatPaginatorModule, MatSelectModule, IconoArchivo, SelectorUsuario, TarjetaReporte],
  providers: [proveerPaginadorEs],
  styleUrl: '../reportes-comun.scss',
  template: `
    <app-tarjeta-reporte
      [codigo]="recibidos() ? 'RR-08' : 'RR-07'"
      [titulo]="recibidos() ? 'Recursos recibidos por un usuario' : 'Recursos compartidos por un usuario'"
      [descripcion]="recibidos() ? 'Lo que otras personas compartieron directamente con el usuario elegido.' : 'Lo que el usuario elegido compartió, con quién y con qué permiso.'"
      [cargando]="r.cargando()"
      [error]="r.error()"
      [csv]="csv()"
    >
      <div filtros class="filtros">
        <app-selector-usuario [(usuarioId)]="usuarioId" />
        <mat-form-field class="chico" subscriptSizing="dynamic">
          <mat-label>Tipo</mat-label>
          <mat-select [value]="tipo()" (valueChange)="tipo.set($event)">
            <mat-option value="">Todos</mat-option>
            <mat-option value="archivo">Archivos</mat-option>
            <mat-option value="carpeta">Carpetas</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
      @if (r.datos(); as d) {
        <div class="indicadores">
          <div class="indicador"><span class="valor">{{ d.total }}</span><span class="nombre">comparticiones</span></div>
          <div class="indicador"><span class="valor">{{ d.personas }}</span><span class="nombre">{{ recibidos() ? 'personas que le compartieron' : 'personas distintas' }}</span></div>
          @for (p of d.porPermiso; track p.permiso) {
            <div class="indicador"><span class="valor">{{ p.cantidad }}</span><span class="nombre">con {{ permiso(p.permiso).toLowerCase() }}</span></div>
          }
        </div>
        <div class="contenedor-tabla">
          <table class="tabla">
            <thead><tr><th>Recurso</th><th>{{ recibidos() ? 'Propietario' : 'Compartido con' }}</th><th>Permiso</th><th>Estado</th><th>Desde</th></tr></thead>
            <tbody>
              @for (c of d.datos; track c._id) {
                <tr>
                  <td>
                    <span class="recurso"><app-icono-archivo [tipo]="c.tipoRecurso" [extension]="c.recurso.extension" />{{ c.recurso.nombre ?? '(eliminado)' }}</span>
                  </td>
                  <td>{{ (recibidos() ? c.propietario : c.destinatario)?.nombreCompleto ?? '—' }}</td>
                  <td>{{ permiso(c.permiso) }}</td>
                  <td><span class="estado" [class]="c.estado">{{ estado[c.estado] }}</span></td>
                  <td>{{ c.creadoEn | date: 'mediumDate' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="vacio">{{ recibidos() ? 'No ha recibido nada compartido.' : 'No ha compartido nada.' }}</td></tr>
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
  styles: `
    .recurso {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rr07ComparticionesUsuario {
  private readonly api = inject(ReportesApi);
  /** false: RR-07 (compartidos por); true: RR-08 (recibidos por). */
  readonly recibidos = input(false);
  protected readonly usuarioId = signal<string | null>(null);
  protected readonly tipo = signal<TipoRecurso | ''>('');
  protected readonly pagina = signal(0);
  protected readonly limite = signal(10);
  protected readonly permiso = nombrePermiso;
  protected readonly estado = nombreEstado;

  constructor() {
    effect(() => {
      this.usuarioId();
      this.tipo();
      untracked(() => this.pagina.set(0));
    });
  }

  protected readonly r = cargarReporte(
    computed(() => ({ usuarioId: this.usuarioId(), recibidos: this.recibidos(), tipo: this.tipo(), pagina: this.pagina() + 1, limite: this.limite() })),
    ({ usuarioId, recibidos, ...p }) => {
      // Hasta que se elige un usuario no hay nada que pedir.
      if (!usuarioId) return of(undefined);
      return recibidos ? this.api.recibidosPorUsuario(usuarioId, p) : this.api.compartidosPorUsuario(usuarioId, p);
    },
  );
  protected readonly csv = computed(() => {
    const d = this.r.datos();
    if (!d) return null;
    const recibidos = this.recibidos();
    return {
      nombre: `${recibidos ? 'RR-08 recibidos por' : 'RR-07 compartidos por'} ${d.usuario.nombreUsuario}`,
      encabezados: ['Tipo', 'Recurso', recibidos ? 'Propietario' : 'Compartido con', 'Permiso', 'Estado', 'Desde'],
      filas: d.datos.map((c) => [c.tipoRecurso, c.recurso.nombre, (recibidos ? c.propietario : c.destinatario)?.nombreUsuario, c.permiso, c.estado, c.creadoEn]),
    };
  });

  protected cambiarPagina(e: PageEvent): void {
    this.limite.set(e.pageSize);
    this.pagina.set(e.pageIndex);
  }
}
