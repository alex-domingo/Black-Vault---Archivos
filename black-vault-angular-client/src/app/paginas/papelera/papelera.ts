import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { DatosConfirmacion, DialogoConfirmacion } from '../../compartido/componentes/dialogo-confirmacion/dialogo-confirmacion';
import { IconoArchivo } from '../../compartido/componentes/icono-archivo/icono-archivo';
import { BytesPipe } from '../../compartido/pipes/bytes.pipe';
import { proveerPaginadorEs } from '../../nucleo/i18n/paginador-es';
import { TipoRecurso } from '../../nucleo/modelos/comparticiones';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { ElementoPapelera, ResultadoEliminacion } from '../../nucleo/modelos/papelera';
import { Paginado } from '../../nucleo/modelos/usuario';
import { Almacenamiento } from '../../nucleo/servicios/almacenamiento';
import { Notificador } from '../../nucleo/servicios/notificador';
import { PapeleraApi } from '../../nucleo/servicios/papelera-api';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** Papelera del usuario: restaurar, eliminar definitivamente y vaciar (RF-13). */
@Component({
  selector: 'app-papelera',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    IconoArchivo,
    BytesPipe,
  ],
  providers: [proveerPaginadorEs],
  templateUrl: './papelera.html',
  styleUrl: './papelera.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Papelera {
  private readonly api = inject(PapeleraApi);
  private readonly dialogo = inject(MatDialog);
  private readonly notificador = inject(Notificador);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  protected readonly almacenamiento = inject(Almacenamiento);

  protected readonly buscar = new FormControl('', { nonNullable: true });
  protected readonly tipo = new FormControl<TipoRecurso | ''>('', { nonNullable: true });
  private readonly textoBuscado = toSignal(this.buscar.valueChanges.pipe(debounceTime(300), map((t) => t.trim())), { initialValue: '' });
  private readonly tipoElegido = toSignal(this.tipo.valueChanges, { initialValue: '' as TipoRecurso | '' });
  protected readonly pagina = signal(0);
  protected readonly limite = signal(20);
  private readonly recarga = signal(0);
  /** Elementos con una operación en curso. */
  protected readonly ocupados = signal<ReadonlySet<string>>(new Set());
  protected readonly vaciando = signal(false);

  constructor() {
    this.almacenamiento.refrescar();
    effect(() => {
      this.textoBuscado();
      this.tipoElegido();
      untracked(() => this.pagina.set(0));
    });
  }

  private readonly consulta = computed(() => ({
    filtro: { buscar: this.textoBuscado() || undefined, tipo: this.tipoElegido() || undefined, pagina: this.pagina() + 1, limite: this.limite() },
    recarga: this.recarga(),
  }));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly respuesta = toSignal(
    toObservable(this.consulta).pipe(
      tap(() => this.cargando.set(true)),
      switchMap(({ filtro }) =>
        this.api.listar(filtro).pipe(
          tap(() => this.error.set(null)),
          catchError((error: unknown) => {
            this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo cargar la papelera.');
            return of<Paginado<ElementoPapelera> | null>(null);
          }),
        ),
      ),
      tap(() => this.cargando.set(false)),
    ),
    { initialValue: null },
  );
  protected readonly elementos = computed(() => this.respuesta()?.datos ?? []);
  protected readonly total = computed(() => this.respuesta()?.total ?? 0);
  protected readonly hayFiltros = computed(() => !!(this.textoBuscado() || this.tipoElegido()));
  protected readonly espacioEnPapelera = computed(() => this.almacenamiento.estado()?.enPapelera ?? null);

  protected ubicacion(e: ElementoPapelera): string {
    return ['Mi unidad', ...e.ubicacionOriginal].join(' / ');
  }

  protected resumenContenido(e: ElementoPapelera): string {
    if (e.tipo === 'archivo') return '';
    const partes = [plural(e.contenido.archivos, 'archivo', 'archivos')];
    if (e.contenido.carpetas) partes.push(plural(e.contenido.carpetas, 'subcarpeta', 'subcarpetas'));
    return partes.join(', ');
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.limite.set(evento.pageSize);
    this.pagina.set(evento.pageIndex);
  }

  private recargar(): void {
    this.recarga.update((n) => n + 1);
    this.almacenamiento.refrescar();
  }

  private marcar(id: string, ocupado: boolean): void {
    this.ocupados.update((actual) => {
      const nuevo = new Set(actual);
      if (ocupado) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });
  }

  protected restaurar(e: ElementoPapelera): void {
    const id = e.recurso._id;
    this.marcar(id, true);
    this.api.restaurar(e.tipo, id).subscribe({
      next: (r) => {
        this.marcar(id, false);
        this.recargar();
        const donde = r.destino?.nombre ?? 'Mi unidad';
        const nombre = r.nombre !== r.nombreAnterior ? ` como "${r.nombre}" (ya había otro con ese nombre)` : '';
        const aviso = this.snackBar.open(`"${r.nombreAnterior}" se restauró en ${donde}${nombre}.`, 'Abrir', { duration: 7000 });
        aviso.onAction().subscribe(() => {
          if (r.tipo === 'archivo') void this.router.navigate(['/archivo', r._id]);
          else void this.router.navigate(['/mi-unidad/carpeta', r._id]);
        });
      },
      error: (error: unknown) => {
        this.marcar(id, false);
        this.notificador.error(error, 'No se pudo restaurar.');
        this.recargar();
      },
    });
  }

  private confirmar(datos: DatosConfirmacion, alConfirmar: () => void): void {
    this.dialogo
      .open<DialogoConfirmacion, DatosConfirmacion, boolean>(DialogoConfirmacion, { data: datos })
      .afterClosed()
      .subscribe((si) => si && alConfirmar());
  }

  protected eliminar(e: ElementoPapelera): void {
    const que = e.tipo === 'carpeta' ? `la carpeta "${e.recurso.nombre}" y todo su contenido (${this.resumenContenido(e)})` : `"${e.recurso.nombre}"`;
    this.confirmar(
      {
        titulo: 'Eliminar definitivamente',
        mensaje: `Se eliminará ${que} y se liberarán ${kb(e.contenido.bytes)}. Esta acción no se puede deshacer.`,
        textoConfirmar: 'Eliminar definitivamente',
        peligroso: true,
      },
      () => {
        const id = e.recurso._id;
        this.marcar(id, true);
        this.api.eliminar(e.tipo, id).subscribe({
          next: (r) => {
            this.marcar(id, false);
            this.recargar();
            this.notificador.exito(`"${e.recurso.nombre}" se eliminó definitivamente. Se liberaron ${kb(r.bytes)}.`);
          },
          error: (error: unknown) => {
            this.marcar(id, false);
            this.notificador.error(error, 'No se pudo eliminar.');
          },
        });
      },
    );
  }

  protected vaciar(): void {
    const enPapelera = this.espacioEnPapelera();
    this.confirmar(
      {
        titulo: 'Vaciar la papelera',
        mensaje: `Se eliminará definitivamente todo lo que hay en la papelera${enPapelera ? ` (${plural(enPapelera.archivos, 'archivo', 'archivos')}, ${kb(enPapelera.bytes)})` : ''}. Esta acción no se puede deshacer.`,
        textoConfirmar: 'Vaciar papelera',
        peligroso: true,
      },
      () => {
        this.vaciando.set(true);
        this.api.vaciar().subscribe({
          next: (r: ResultadoEliminacion) => {
            this.vaciando.set(false);
            this.recargar();
            this.notificador.exito(`Papelera vacía. Se liberaron ${kb(r.bytes)}.`);
          },
          error: (error: unknown) => {
            this.vaciando.set(false);
            this.notificador.error(error, 'No se pudo vaciar la papelera.');
          },
        });
      },
    );
  }
}
