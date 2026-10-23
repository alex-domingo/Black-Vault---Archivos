import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Observable, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { Avatar } from '../../compartido/componentes/avatar/avatar';
import { IconoArchivo } from '../../compartido/componentes/icono-archivo/icono-archivo';
import { proveerPaginadorEs } from '../../nucleo/i18n/paginador-es';
import {
  CompartidoConmigo,
  CompartidoPorMi,
  FiltroCompartidos,
  PERMISOS,
  Permiso,
  TipoRecurso,
} from '../../nucleo/modelos/comparticiones';
import { Archivo, Carpeta } from '../../nucleo/modelos/documentos';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { Paginado } from '../../nucleo/modelos/usuario';
import { ComparticionesApi } from '../../nucleo/servicios/comparticiones-api';

type Vista = 'conmigo' | 'por-mi';
type Respuesta = { vista: 'conmigo'; pagina: Paginado<CompartidoConmigo> } | { vista: 'por-mi'; pagina: Paginado<CompartidoPorMi> };

const MAXIMO_AVATARES = 4;

/** "Compartidos conmigo" y "Compartidos por mí" (RF-11, RF-12). */
@Component({
  selector: 'app-compartidos',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    Avatar,
    IconoArchivo,
  ],
  providers: [proveerPaginadorEs],
  templateUrl: './compartidos.html',
  styleUrl: './compartidos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Compartidos {
  private readonly api = inject(ComparticionesApi);
  private readonly dialogo = inject(MatDialog);

  /** Parámetro ?vista= de la ruta. */
  readonly vista = input<string>();
  protected readonly vistaActual = computed<Vista>(() => (this.vista() === 'por-mi' ? 'por-mi' : 'conmigo'));

  protected readonly maximoAvatares = MAXIMO_AVATARES;
  protected readonly buscar = new FormControl('', { nonNullable: true });
  protected readonly tipo = new FormControl<TipoRecurso | ''>('', { nonNullable: true });
  private readonly textoBuscado = toSignal(this.buscar.valueChanges.pipe(debounceTime(300), map((t) => t.trim())), { initialValue: '' });
  private readonly tipoElegido = toSignal(this.tipo.valueChanges, { initialValue: '' as TipoRecurso | '' });
  protected readonly pagina = signal(0);
  protected readonly limite = signal(20);
  private readonly recarga = signal(0);

  constructor() {
    // Cambiar de pestaña o de filtro vuelve a la primera página.
    effect(() => {
      this.vistaActual();
      this.textoBuscado();
      this.tipoElegido();
      untracked(() => this.pagina.set(0));
    });
  }

  private readonly consulta = computed(() => ({
    vista: this.vistaActual(),
    filtro: {
      buscar: this.textoBuscado() || undefined,
      tipo: this.tipoElegido() || undefined,
      pagina: this.pagina() + 1,
      limite: this.limite(),
    } satisfies FiltroCompartidos,
    recarga: this.recarga(),
  }));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly respuesta = toSignal(
    toObservable(this.consulta).pipe(
      tap(() => this.cargando.set(true)),
      switchMap(({ vista, filtro }) => {
        const peticion: Observable<Respuesta> =
          vista === 'conmigo'
            ? this.api.conmigo(filtro).pipe(map((pagina) => ({ vista, pagina })))
            : this.api.realizadas(filtro).pipe(map((pagina) => ({ vista, pagina })));
        return peticion.pipe(
          tap(() => this.error.set(null)),
          catchError((error: unknown) => {
            this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo cargar la lista.');
            return of(null);
          }),
        );
      }),
      tap(() => this.cargando.set(false)),
    ),
    { initialValue: null },
  );

  protected readonly conmigo = computed(() => {
    const r = this.respuesta();
    return r?.vista === 'conmigo' && this.vistaActual() === 'conmigo' ? r.pagina.datos : null;
  });
  protected readonly porMi = computed(() => {
    const r = this.respuesta();
    return r?.vista === 'por-mi' && this.vistaActual() === 'por-mi' ? r.pagina.datos : null;
  });
  protected readonly total = computed(() => this.respuesta()?.pagina.total ?? 0);
  protected readonly hayFiltros = computed(() => !!(this.textoBuscado() || this.tipoElegido()));

  protected etiquetaPermiso(permiso: Permiso): string {
    return PERMISOS.find((p) => p.valor === permiso)?.etiqueta ?? permiso;
  }

  /** Lo ajeno se abre bajo "Compartidos"; lo propio, en "Mi unidad". */
  protected enlace(recurso: Carpeta | Archivo, propio: boolean): unknown[] {
    if (recurso.tipo === 'archivo') return ['/archivo', recurso._id];
    return [propio ? '/mi-unidad/carpeta' : '/compartidos/carpeta', recurso._id];
  }

  protected nombres(grupo: CompartidoPorMi): string {
    return grupo.comparticiones.map((c) => `${c.destinatario?.nombreCompleto ?? '?'} (${this.etiquetaPermiso(c.permiso)})`).join(', ');
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.limite.set(evento.pageSize);
    this.pagina.set(evento.pageIndex);
  }

  protected limpiar(): void {
    this.buscar.setValue('');
    this.tipo.setValue('');
  }

  protected async gestionar(grupo: CompartidoPorMi): Promise<void> {
    const { DialogoCompartir } = await import('../../compartido/componentes/dialogo-compartir/dialogo-compartir');
    this.dialogo
      .open(DialogoCompartir, {
        data: { tipo: grupo.tipoRecurso, id: grupo.recurso._id, nombre: grupo.recurso.nombre },
        width: '620px',
        // Foco en el título: si fuera al buscador, su lista taparía a quienes ya tienen acceso.
        autoFocus: 'first-heading',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe(() => this.recarga.update((n) => n + 1));
  }
}
