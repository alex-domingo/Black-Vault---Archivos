import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
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
import { catchError, map, of, startWith, switchMap, tap } from 'rxjs';
import { ListaActividad } from '../../compartido/componentes/lista-actividad/lista-actividad';
import { proveerPaginadorEs } from '../../nucleo/i18n/paginador-es';
import { ACCIONES, Actividad, AlcanceActividad, CATEGORIAS_ACTIVIDAD, CategoriaActividad, FiltroActividad } from '../../nucleo/modelos/actividad';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { Paginado, Usuario } from '../../nucleo/modelos/usuario';
import { ActividadesApi } from '../../nucleo/servicios/actividades-api';
import { Sesion } from '../../nucleo/servicios/sesion';
import { UsuariosApi } from '../../nucleo/servicios/usuarios-api';

/** Fecha local del calendario → 'AAAA-MM-DD' (el servidor la interpreta en hora de Guatemala). */
function aDia(fecha: Date | null): string | undefined {
  if (!fecha) return undefined;
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Historial de actividad (RF-14). El administrador ve todo el sistema y filtra por usuario (RF-15). */
@Component({
  selector: 'app-actividad',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    ListaActividad,
  ],
  providers: [proveerPaginadorEs],
  templateUrl: './actividad.html',
  styleUrl: './actividad.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginaActividad {
  private readonly api = inject(ActividadesApi);
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly sesion = inject(Sesion);
  protected readonly admin = computed(() => this.sesion.usuario()?.rol === 'administrador');

  protected readonly categorias = CATEGORIAS_ACTIVIDAD;
  protected readonly alcances: { valor: AlcanceActividad; etiqueta: string }[] = [
    { valor: 'todo', etiqueta: 'Todo' },
    { valor: 'mias', etiqueta: 'Lo que hice' },
    { valor: 'mis-recursos', etiqueta: 'Lo que otros hicieron con lo mío' },
    { valor: 'conmigo', etiqueta: 'Lo que otros hicieron conmigo' },
  ];

  protected readonly filtros = new FormGroup({
    alcance: new FormControl<AlcanceActividad>('todo', { nonNullable: true }),
    usuarioId: new FormControl('', { nonNullable: true }),
    categoria: new FormControl<CategoriaActividad | ''>('', { nonNullable: true }),
    accion: new FormControl('', { nonNullable: true }),
    desde: new FormControl<Date | null>(null),
    hasta: new FormControl<Date | null>(null),
  });
  private readonly valores = toSignal(this.filtros.valueChanges.pipe(map(() => this.filtros.getRawValue())), {
    initialValue: this.filtros.getRawValue(),
  });
  protected readonly pagina = signal(0);
  protected readonly limite = signal(50);

  /** Acciones de la categoría elegida (o todas). */
  protected readonly acciones = computed(() => {
    const categoria = this.valores().categoria;
    return categoria ? ACCIONES.filter((a) => a.categoria === categoria) : ACCIONES;
  });

  /** Para el administrador: lista de usuarios para filtrar. */
  protected readonly usuarios = toSignal(
    toObservable(this.admin).pipe(
      switchMap((admin) =>
        admin
          ? this.usuariosApi.listar({ pagina: 1, limite: 100 }).pipe(
              map((r: Paginado<Usuario>) => r.datos),
              catchError(() => of([] as Usuario[])),
            )
          : of([] as Usuario[]),
      ),
    ),
    { initialValue: [] as Usuario[] },
  );

  constructor() {
    effect(() => {
      this.valores();
      untracked(() => this.pagina.set(0));
    });
    // Si la acción elegida no es de la nueva categoría, se quita.
    this.filtros.controls.categoria.valueChanges.subscribe((categoria) => {
      const accion = this.filtros.controls.accion.value;
      if (accion && categoria && !ACCIONES.some((a) => a.valor === accion && a.categoria === categoria)) {
        this.filtros.controls.accion.setValue('');
      }
    });
    // El filtro por usuario solo se combina con "todo".
    this.filtros.controls.usuarioId.valueChanges.subscribe((id) => {
      if (id && this.filtros.controls.alcance.value !== 'todo') this.filtros.controls.alcance.setValue('todo');
    });
  }

  private readonly filtro = computed<FiltroActividad>(() => {
    const v = this.valores();
    return {
      alcance: v.alcance,
      usuarioId: this.admin() && v.alcance === 'todo' ? v.usuarioId || undefined : undefined,
      categoria: v.categoria || undefined,
      accion: v.accion || undefined,
      desde: aDia(v.desde),
      hasta: aDia(v.hasta),
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
        this.api.listar(filtro).pipe(
          tap(() => this.error.set(null)),
          catchError((error: unknown) => {
            this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo cargar la actividad.');
            return of<Paginado<Actividad> | null>(null);
          }),
        ),
      ),
      tap(() => this.cargando.set(false)),
      startWith(null),
    ),
  );
  protected readonly actividades = computed(() => this.respuesta()?.datos ?? []);
  protected readonly total = computed(() => this.respuesta()?.total ?? 0);
  protected readonly hayFiltros = computed(() => {
    const v = this.valores();
    return !!(v.usuarioId || v.categoria || v.accion || v.desde || v.hasta || v.alcance !== 'todo');
  });

  protected cambiarPagina(evento: PageEvent): void {
    this.limite.set(evento.pageSize);
    this.pagina.set(evento.pageIndex);
  }

  protected limpiar(): void {
    this.filtros.reset();
  }
}
