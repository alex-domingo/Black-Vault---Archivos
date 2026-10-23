import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { IconoArchivo } from '../../compartido/componentes/icono-archivo/icono-archivo';
import { guardarRespuesta } from '../../compartido/descargas';
import { BytesPipe } from '../../compartido/pipes/bytes.pipe';
import {
  Archivo,
  ContenidoCarpeta,
  Elemento,
  NOMBRE_NIVEL,
  OrdenContenido,
  tieneNivel,
} from '../../nucleo/modelos/documentos';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { Almacenamiento } from '../../nucleo/servicios/almacenamiento';
import { ArchivosApi } from '../../nucleo/servicios/archivos-api';
import { CarpetasApi } from '../../nucleo/servicios/carpetas-api';
import { Notificador } from '../../nucleo/servicios/notificador';
import { DatosDialogoMover, DialogoMover } from './dialogo-mover';
import { DatosDialogoNombre, DialogoNombre } from './dialogo-nombre';
import { DialogoPropiedades } from './dialogo-propiedades';
import { DatosDialogoSubir, DialogoSubir } from './dialogo-subir';
import { PanelDetalles, SeleccionDetalle } from './panel-detalles';

type Estado = { tipo: 'cargando' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; datos: ContenidoCarpeta };

const CLAVE_ORDEN = 'black-vault.orden';

function leerOrden(): { orden: OrdenContenido; direccion: 'asc' | 'desc' } {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_ORDEN) ?? 'null');
    if (guardado?.orden && guardado?.direccion) return guardado;
  } catch {
    // sin almacenamiento disponible
  }
  return { orden: 'nombre', direccion: 'asc' };
}

/** Explorador de "Mi unidad" y de las carpetas a las que se tiene acceso. */
@Component({
  selector: 'app-mi-unidad',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    IconoArchivo,
    BytesPipe,
    PanelDetalles,
  ],
  templateUrl: './mi-unidad.html',
  styleUrl: './mi-unidad.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiUnidad {
  private readonly carpetasApi = inject(CarpetasApi);
  private readonly archivosApi = inject(ArchivosApi);
  private readonly dialogo = inject(MatDialog);
  private readonly notificador = inject(Notificador);
  private readonly almacenamiento = inject(Almacenamiento);
  private readonly router = inject(Router);
  private readonly selectorArchivos = viewChild.required<ElementRef<HTMLInputElement>>('selectorArchivos');

  /** Id de la carpeta (parámetro :id de la ruta). Sin id = raíz de "Mi unidad". */
  readonly id = input<string>();

  protected readonly nombresNivel = NOMBRE_NIVEL;
  protected readonly orden = signal<OrdenContenido>(leerOrden().orden);
  protected readonly direccion = signal<'asc' | 'desc'>(leerOrden().direccion);
  private readonly recarga = signal(0);

  protected readonly seleccion = signal<SeleccionDetalle | null>(null);
  protected readonly arrastrando = signal(false);

  private readonly consulta = computed(() => ({
    id: this.id() ?? null,
    orden: this.orden(),
    direccion: this.direccion(),
    recarga: this.recarga(),
  }));

  protected readonly estado = toSignal(
    toObservable(this.consulta).pipe(
      switchMap(({ id, orden, direccion }) =>
        this.carpetasApi.contenido(id, orden, direccion).pipe(
          map((datos): Estado => ({ tipo: 'listo', datos })),
          catchError((error: unknown) =>
            of<Estado>({ tipo: 'error', mensaje: error instanceof ErrorApi ? error.message : 'No se pudo cargar la carpeta.' }),
          ),
          startWith<Estado>({ tipo: 'cargando' }),
        ),
      ),
    ),
    { initialValue: { tipo: 'cargando' } as Estado },
  );

  /** Último contenido cargado: mientras se recarga se sigue mostrando, para que la lista no parpadee. */
  protected readonly datos = linkedSignal<Estado, ContenidoCarpeta | null>({
    source: this.estado,
    computation: (estado, anterior) =>
      estado.tipo === 'listo' ? estado.datos : estado.tipo === 'error' ? null : (anterior?.value ?? null),
  });

  protected readonly acceso = computed(() => this.datos()?.acceso ?? null);
  protected readonly esPropio = computed(() => this.acceso() === 'propietario');
  protected readonly puedeEditar = computed(() => tieneNivel(this.acceso(), 'edicion'));
  protected readonly nombreActual = computed(() => this.datos()?.carpeta?.nombre ?? 'Mi unidad');
  protected readonly vacia = computed(() => {
    const d = this.datos();
    return !!d && d.carpetas.length === 0 && d.archivos.length === 0;
  });

  protected readonly opcionesOrden: { valor: OrdenContenido; etiqueta: string }[] = [
    { valor: 'nombre', etiqueta: 'Nombre' },
    { valor: 'fecha', etiqueta: 'Fecha de modificación' },
    { valor: 'tamano', etiqueta: 'Tamaño' },
    { valor: 'tipo', etiqueta: 'Tipo' },
  ];

  // ---------- Navegación y orden ----------
  protected cambiarOrden(orden: OrdenContenido): void {
    this.orden.set(orden);
    this.guardarOrden();
  }

  protected alternarDireccion(): void {
    this.direccion.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    this.guardarOrden();
  }

  private guardarOrden(): void {
    try {
      localStorage.setItem(CLAVE_ORDEN, JSON.stringify({ orden: this.orden(), direccion: this.direccion() }));
    } catch {
      // preferencia no esencial
    }
  }

  protected abrir(elemento: Elemento): void {
    if (elemento.tipo === 'carpeta') void this.router.navigate(['/mi-unidad/carpeta', elemento._id]);
    else void this.router.navigate(['/archivo', elemento._id]);
  }

  private recargar(): void {
    this.recarga.update((n) => n + 1);
    const actual = this.seleccion();
    if (actual) this.seleccion.set({ ...actual, version: (actual.version ?? 0) + 1 });
  }

  // ---------- Detalles ----------
  protected verDetalles(elemento: Elemento | null): void {
    if (elemento) {
      this.seleccion.set({ tipo: elemento.tipo, id: elemento._id });
      return;
    }
    const carpeta = this.datos()?.carpeta;
    this.seleccion.set(carpeta ? { tipo: 'carpeta', id: carpeta._id } : null);
  }

  // ---------- Crear y subir ----------
  protected nuevaCarpeta(): void {
    const padreId = this.id() ?? null;
    this.dialogo
      .open<DialogoNombre, DatosDialogoNombre, boolean>(DialogoNombre, {
        data: {
          titulo: 'Nueva carpeta',
          etiqueta: 'Nombre de la carpeta',
          valorInicial: 'Carpeta nueva',
          textoBoton: 'Crear',
          accion: (nombre) => this.carpetasApi.crear(nombre, padreId),
        },
      })
      .afterClosed()
      .subscribe((creada) => {
        if (!creada) return;
        this.notificador.exito('Carpeta creada.');
        this.recargar();
      });
  }

  protected elegirArchivos(): void {
    this.selectorArchivos().nativeElement.click();
  }

  protected alElegirArchivos(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivos = Array.from(entrada.files ?? []);
    entrada.value = ''; // permite volver a elegir el mismo archivo
    if (archivos.length) this.abrirSubida(archivos);
  }

  protected alArrastrar(evento: DragEvent, encima: boolean): void {
    if (!this.puedeEditar() || !evento.dataTransfer?.types.includes('Files')) return;
    evento.preventDefault();
    this.arrastrando.set(encima);
  }

  protected alSoltar(evento: DragEvent): void {
    if (!this.puedeEditar()) return;
    evento.preventDefault();
    this.arrastrando.set(false);
    const archivos = Array.from(evento.dataTransfer?.files ?? []);
    if (archivos.length) this.abrirSubida(archivos);
  }

  private abrirSubida(archivos: File[]): void {
    this.dialogo
      .open<DialogoSubir, DatosDialogoSubir, number>(DialogoSubir, {
        data: { archivos, carpetaId: this.id() ?? null, nombreDestino: this.nombreActual() },
        width: '560px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((subidos) => {
        if (subidos) this.notificador.exito(subidos === 1 ? 'Archivo subido.' : `${subidos} archivos subidos.`);
        this.recargar();
        this.almacenamiento.refrescar();
      });
  }

  // ---------- Acciones sobre un elemento ----------
  protected renombrar(elemento: Elemento): void {
    const esArchivo = elemento.tipo === 'archivo';
    const sufijo = esArchivo ? `.${elemento.extension}` : undefined;
    const base = esArchivo ? elemento.nombre.slice(0, -sufijo!.length) : elemento.nombre;
    const accion = (nombre: string): Observable<unknown> =>
      esArchivo ? this.archivosApi.actualizar(elemento._id, { nombre: `${nombre}${sufijo}` }) : this.carpetasApi.renombrar(elemento._id, nombre);

    this.dialogo
      .open<DialogoNombre, DatosDialogoNombre, boolean>(DialogoNombre, {
        data: { titulo: 'Cambiar nombre', etiqueta: 'Nombre', valorInicial: base, sufijo, textoBoton: 'Guardar', accion },
      })
      .afterClosed()
      .subscribe((hecho) => {
        if (!hecho) return;
        this.notificador.exito('Nombre actualizado.');
        this.recargar();
      });
  }

  protected mover(elemento: Elemento): void {
    const ubicacionActual = elemento.tipo === 'carpeta' ? elemento.padreId : elemento.carpetaId;
    const accion = (destinoId: string | null): Observable<unknown> =>
      elemento.tipo === 'carpeta' ? this.carpetasApi.mover(elemento._id, destinoId) : this.archivosApi.mover(elemento._id, destinoId);

    this.dialogo
      .open<DialogoMover, DatosDialogoMover, boolean>(DialogoMover, {
        data: { tipo: elemento.tipo, id: elemento._id, nombre: elemento.nombre, ubicacionActual, accion },
        width: '520px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((movido) => {
        if (!movido) return;
        this.notificador.exito(`"${elemento.nombre}" se movió.`);
        if (this.seleccion()?.id === elemento._id) this.seleccion.set(null);
        this.recargar();
      });
  }

  protected clasificar(archivo: Archivo): void {
    this.dialogo
      .open<DialogoPropiedades, Archivo, Archivo>(DialogoPropiedades, { data: archivo })
      .afterClosed()
      .subscribe((actualizado) => {
        if (!actualizado) return;
        this.notificador.exito('Clasificación guardada.');
        this.recargar();
      });
  }

  protected descargar(archivo: Archivo): void {
    this.archivosApi.descargar(archivo._id).subscribe({
      next: (respuesta) => guardarRespuesta(respuesta, archivo.nombre),
      error: (error: unknown) => this.notificador.error(error, 'No se pudo descargar el archivo.'),
    });
  }
}
