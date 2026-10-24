import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { IconoArchivo } from '../../compartido/componentes/icono-archivo/icono-archivo';
import { VistaMarkdown } from '../../compartido/componentes/vista-markdown/vista-markdown';
import { guardarRespuesta } from '../../compartido/descargas';
import { BytesPipe } from '../../compartido/pipes/bytes.pipe';
import { CATEGORIAS, DetalleArchivo, NOMBRE_NIVEL, TextoArchivo, tieneNivel } from '../../nucleo/modelos/documentos';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { Almacenamiento } from '../../nucleo/servicios/almacenamiento';
import { ArchivosApi } from '../../nucleo/servicios/archivos-api';
import { EnviarPapelera } from '../../nucleo/servicios/enviar-papelera';
import { Notificador } from '../../nucleo/servicios/notificador';
import { ConCambiosSinGuardar } from '../../nucleo/guardias/cambios-sin-guardar.guard';
import { PanelDetalles } from '../mi-unidad/panel-detalles';
import { Comentarios } from './comentarios';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; detalle: DetalleArchivo; texto: TextoArchivo };

/** El navegador entrega siempre saltos LF; el servidor restaura CRLF y BOM al guardar. */
const sinCr = (texto: string) => texto.replace(/\r\n/g, '\n');

/** Vista previa (Markdown renderizado o texto) y edición del contenido. */
@Component({
  selector: 'app-visor',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    IconoArchivo,
    VistaMarkdown,
    BytesPipe,
    PanelDetalles,
    Comentarios,
  ],
  templateUrl: './visor.html',
  styleUrl: './visor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Visor implements ConCambiosSinGuardar {
  private readonly api = inject(ArchivosApi);
  private readonly notificador = inject(Notificador);
  private readonly almacenamiento = inject(Almacenamiento);
  private readonly dialogo = inject(MatDialog);
  private readonly papelera = inject(EnviarPapelera);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  private readonly recarga = signal(0);
  protected readonly editando = signal(false);
  protected readonly borrador = signal('');
  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);
  protected readonly conflicto = signal(false);
  protected readonly verDetalles = signal(false);
  /** Hace que el panel de detalles vuelva a consultar (por ejemplo, tras compartir). */
  protected readonly versionDetalles = signal(0);
  protected readonly nombresNivel = NOMBRE_NIVEL;

  protected readonly estado = toSignal(
    toObservable(computed(() => ({ id: this.id(), recarga: this.recarga() }))).pipe(
      switchMap(({ id }) =>
        forkJoin({ detalle: this.api.detalle(id), texto: this.api.leerTexto(id) }).pipe(
          map(({ detalle, texto }): Estado => ({ tipo: 'listo', detalle, texto })),
          catchError((error: unknown) =>
            of<Estado>({ tipo: 'error', mensaje: error instanceof ErrorApi ? error.message : 'No se pudo abrir el archivo.' }),
          ),
          startWith<Estado>({ tipo: 'cargando' }),
        ),
      ),
    ),
    { initialValue: { tipo: 'cargando' } as Estado },
  );

  protected readonly listo = computed(() => {
    const e = this.estado();
    return e.tipo === 'listo' ? e : null;
  });

  protected readonly puedeEditar = computed(() => {
    const l = this.listo();
    return !!l && tieneNivel(l.detalle.acceso, 'edicion') && l.texto.esUtf8;
  });

  /** Público: lo consulta la guarda confirmarCambiosSinGuardar. */
  readonly hayCambios = computed(() => {
    const l = this.listo();
    return this.editando() && !!l && this.borrador() !== sinCr(l.texto.contenido);
  });

  /** A dónde vuelve el botón "atrás": la carpeta que lo contiene. */
  protected readonly volverA = computed(() => {
    const l = this.listo();
    if (!l) return ['/mi-unidad'];
    const propio = l.detalle.acceso === 'propietario';
    const carpeta = l.detalle.ruta.at(-1);
    if (carpeta) return [propio ? '/mi-unidad/carpeta' : '/compartidos/carpeta', carpeta._id];
    return propio ? ['/mi-unidad'] : ['/compartidos'];
  });

  protected categoria(valor: string): string {
    return CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor;
  }

  protected empezarEdicion(): void {
    const l = this.listo();
    if (!l) return;
    this.borrador.set(sinCr(l.texto.contenido));
    this.errorGuardar.set(null);
    this.conflicto.set(false);
    this.editando.set(true);
  }

  protected alEscribir(evento: Event): void {
    this.borrador.set((evento.target as HTMLTextAreaElement).value);
  }

  protected cancelarEdicion(): void {
    this.editando.set(false);
    this.errorGuardar.set(null);
    this.conflicto.set(false);
  }

  protected guardar(): void {
    const l = this.listo();
    if (!l || this.guardando()) return;
    if (!this.hayCambios()) {
      this.editando.set(false);
      return;
    }
    this.guardando.set(true);
    this.errorGuardar.set(null);
    this.api.guardarTexto(l.detalle._id, this.borrador(), l.texto.version).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(false);
        this.notificador.exito('Cambios guardados.');
        this.almacenamiento.refrescar();
        this.recarga.update((n) => n + 1);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.conflicto.set(error instanceof ErrorApi && error.estado === 409 && error.codigo === 'CONFLICTO');
        this.errorGuardar.set(error instanceof ErrorApi ? error.message : 'No se pudieron guardar los cambios.');
      },
    });
  }

  /** Tras un conflicto: descarta los cambios locales y carga la versión más reciente. */
  protected recargarUltimaVersion(): void {
    this.editando.set(false);
    this.conflicto.set(false);
    this.errorGuardar.set(null);
    this.recarga.update((n) => n + 1);
  }

  protected descargar(): void {
    const l = this.listo();
    if (!l) return;
    this.api.descargar(l.detalle._id).subscribe({
      next: (respuesta) => guardarRespuesta(respuesta, l.detalle.nombre),
      error: (error: unknown) => this.notificador.error(error, 'No se pudo descargar el archivo.'),
    });
  }

  /** Solo el propietario comparte. El diálogo se carga cuando hace falta. */
  protected async compartir(): Promise<void> {
    const l = this.listo();
    if (!l) return;
    const { DialogoCompartir } = await import('../../compartido/componentes/dialogo-compartir/dialogo-compartir');
    this.dialogo
      .open(DialogoCompartir, { data: { tipo: 'archivo', id: l.detalle._id, nombre: l.detalle.nombre }, width: '620px',
        // Foco en el título: si fuera al buscador, su lista taparía a quienes ya tienen acceso.
        autoFocus: 'first-heading', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(() => this.versionDetalles.update((n) => n + 1));
  }

  /** Lo envía a la papelera y vuelve a la carpeta; el aviso permite deshacer. */
  protected enviarAPapelera(): void {
    const l = this.listo();
    if (!l) return;
    const destino = this.volverA();
    this.papelera.enviar(l.detalle, () => void this.router.navigate(destino));
  }

  /** Avisa al cerrar o recargar la pestaña con cambios sin guardar. */
  @HostListener('window:beforeunload', ['$event'])
  protected antesDeSalir(evento: BeforeUnloadEvent): void {
    if (this.hayCambios()) evento.preventDefault();
  }
}
