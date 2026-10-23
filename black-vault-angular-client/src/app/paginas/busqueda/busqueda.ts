import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, map, of, startWith, switchMap, tap } from 'rxjs';
import { IconoArchivo } from '../../compartido/componentes/icono-archivo/icono-archivo';
import { BytesPipe } from '../../compartido/pipes/bytes.pipe';
import { proveerPaginadorEs } from '../../nucleo/i18n/paginador-es';
import { CATEGORIAS, Categoria, Extension, FiltroBusqueda, ResultadoBusqueda } from '../../nucleo/modelos/documentos';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { Paginado } from '../../nucleo/modelos/usuario';
import { ArchivosApi } from '../../nucleo/servicios/archivos-api';

/** Fecha local del calendario → 'AAAA-MM-DD' (el servidor la interpreta en hora de Guatemala). */
function aDia(fecha: Date | null): string | undefined {
  if (!fecha) return undefined;
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}

/** Búsqueda de archivos propios y compartidos con filtros, orden y paginación (RF-09). */
@Component({
  selector: 'app-busqueda',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    IconoArchivo,
    BytesPipe,
  ],
  providers: [proveerPaginadorEs],
  templateUrl: './busqueda.html',
  styleUrl: './busqueda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Busqueda {
  private readonly api = inject(ArchivosApi);
  private readonly router = inject(Router);
  protected readonly categorias = CATEGORIAS;

  protected readonly filtros = new FormGroup({
    buscar: new FormControl('', { nonNullable: true }),
    modo: new FormControl<'nombre' | 'palabras'>('nombre', { nonNullable: true }),
    tipo: new FormControl<Extension | ''>('', { nonNullable: true }),
    categoria: new FormControl<Categoria | ''>('', { nonNullable: true }),
    etiqueta: new FormControl('', { nonNullable: true }),
    alcance: new FormControl<FiltroBusqueda['alcance']>('todos', { nonNullable: true }),
    desde: new FormControl<Date | null>(null),
    hasta: new FormControl<Date | null>(null),
    orden: new FormControl<FiltroBusqueda['orden']>('fecha', { nonNullable: true }),
    direccion: new FormControl<'asc' | 'desc'>('desc', { nonNullable: true }),
  });

  private readonly valores = toSignal(this.filtros.valueChanges.pipe(debounceTime(350), map(() => this.filtros.getRawValue())), {
    initialValue: this.filtros.getRawValue(),
  });
  protected readonly pagina = signal(0);
  protected readonly limite = signal(20);

  constructor() {
    // Cambiar un filtro vuelve a la primera página.
    this.filtros.valueChanges.subscribe(() => this.pagina.set(0));
  }

  private readonly filtro = computed<FiltroBusqueda>(() => {
    const v = this.valores();
    const termino = v.buscar.trim();
    return {
      buscar: v.modo === 'nombre' && termino ? termino : undefined,
      texto: v.modo === 'palabras' && termino ? termino : undefined,
      tipo: v.tipo || undefined,
      categoria: v.categoria || undefined,
      etiqueta: v.etiqueta.trim() || undefined,
      alcance: v.alcance,
      desde: aDia(v.desde),
      hasta: aDia(v.hasta),
      orden: v.orden === 'relevancia' && v.modo !== 'palabras' ? 'fecha' : v.orden,
      direccion: v.direccion,
      pagina: this.pagina() + 1,
      limite: this.limite(),
    };
  });

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly respuesta = toSignal(
    toObservable(this.filtro).pipe(
      tap(() => this.cargando.set(true)),
      switchMap((filtro) =>
        this.api.buscar(filtro).pipe(
          tap(() => this.error.set(null)),
          catchError((error: unknown) => {
            this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo buscar.');
            return of<Paginado<ResultadoBusqueda> | null>(null);
          }),
        ),
      ),
      tap(() => this.cargando.set(false)),
      startWith(null),
    ),
  );
  protected readonly resultados = computed(() => this.respuesta()?.datos ?? []);
  protected readonly total = computed(() => this.respuesta()?.total ?? 0);
  protected readonly hayFiltros = computed(() => {
    const v = this.valores();
    return !!(v.buscar || v.tipo || v.categoria || v.etiqueta || v.desde || v.hasta || v.alcance !== 'todos');
  });

  protected cambiarPagina(evento: PageEvent): void {
    this.limite.set(evento.pageSize);
    this.pagina.set(evento.pageIndex);
  }

  protected limpiar(): void {
    this.filtros.reset();
  }

  protected abrir(resultado: ResultadoBusqueda): void {
    void this.router.navigate(['/archivo', resultado._id]);
  }

  protected categoria(valor: string): string {
    return CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor;
  }
}
