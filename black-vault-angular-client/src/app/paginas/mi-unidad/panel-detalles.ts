import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { IconoArchivo } from '../../compartido/componentes/icono-archivo/icono-archivo';
import { BytesPipe } from '../../compartido/pipes/bytes.pipe';
import { CATEGORIAS, DetalleArchivo, DetalleCarpeta, NOMBRE_NIVEL } from '../../nucleo/modelos/documentos';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { ArchivosApi } from '../../nucleo/servicios/archivos-api';
import { CarpetasApi } from '../../nucleo/servicios/carpetas-api';

export interface SeleccionDetalle {
  tipo: 'carpeta' | 'archivo';
  id: string;
  /** Cambia cuando el elemento se modifica, para volver a pedir el detalle. */
  version?: number;
  /** Cambia cuando algo externo al elemento cambió (por ejemplo, con quién está compartido). */
  refresco?: number;
}

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'carpeta'; datos: DetalleCarpeta }
  | { tipo: 'archivo'; datos: DetalleArchivo };

/** Propiedad, ubicación, características y fechas de un elemento (RF-07, RF-17). */
@Component({
  selector: 'app-panel-detalles',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule, IconoArchivo, BytesPipe],
  templateUrl: './panel-detalles.html',
  styleUrl: './panel-detalles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelDetalles {
  private readonly carpetasApi = inject(CarpetasApi);
  private readonly archivosApi = inject(ArchivosApi);
  private readonly dialogo = inject(MatDialog);

  readonly seleccion = input.required<SeleccionDetalle>();
  readonly cerrar = output<void>();
  /** El propietario pidió gestionar el acceso. */
  readonly compartir = output<void>();

  protected readonly nombresNivel = NOMBRE_NIVEL;

  protected readonly estado = toSignal(
    toObservable(this.seleccion).pipe(
      switchMap(({ tipo, id }) => {
        const peticion: Observable<Estado> =
          tipo === 'carpeta'
            ? this.carpetasApi.detalle(id).pipe(map((datos): Estado => ({ tipo: 'carpeta', datos })))
            : this.archivosApi.detalle(id).pipe(map((datos): Estado => ({ tipo: 'archivo', datos })));
        return peticion.pipe(
          catchError((error: unknown) =>
            of<Estado>({ tipo: 'error', mensaje: error instanceof ErrorApi ? error.message : 'No se pudo cargar el detalle.' }),
          ),
          startWith<Estado>({ tipo: 'cargando' }),
        );
      }),
    ),
    { initialValue: { tipo: 'cargando' } as Estado },
  );

  /** Ubicación legible: "Mi unidad / Contratos / 2026" (o desde la carpeta compartida). */
  protected readonly ubicacion = computed(() => {
    const estado = this.estado();
    if (estado.tipo !== 'carpeta' && estado.tipo !== 'archivo') return '';
    const ruta = estado.tipo === 'carpeta' ? estado.datos.ruta.slice(0, -1) : estado.datos.ruta;
    const propio = estado.datos.acceso === 'propietario';
    const nombres = ruta.map((r) => r.nombre);
    if (propio) return ['Mi unidad', ...nombres].join(' / ');
    return nombres.length ? nombres.join(' / ') : 'Compartido contigo';
  });

  protected categoria(valor: string): string {
    return CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor;
  }

  /** Línea de tiempo del elemento (solo el propietario la ve). El diálogo se carga cuando hace falta. */
  protected async verActividad(tipo: 'carpeta' | 'archivo', id: string, nombre: string): Promise<void> {
    const { DialogoActividadRecurso } = await import('../../compartido/componentes/dialogo-actividad-recurso/dialogo-actividad-recurso');
    this.dialogo.open(DialogoActividadRecurso, { data: { tipo, id, nombre }, width: '640px', maxWidth: '95vw', autoFocus: 'first-heading' });
  }
}
