import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
import { Avatar } from '../../../compartido/componentes/avatar/avatar';
import { DatosConfirmacion, DialogoConfirmacion } from '../../../compartido/componentes/dialogo-confirmacion/dialogo-confirmacion';
import { BytesPipe } from '../../../compartido/pipes/bytes.pipe';
import { proveerPaginadorEs } from '../../../nucleo/i18n/paginador-es';
import { ErrorApi } from '../../../nucleo/modelos/error-api';
import { Paginado, Rol, Usuario } from '../../../nucleo/modelos/usuario';
import { Notificador } from '../../../nucleo/servicios/notificador';
import { Sesion } from '../../../nucleo/servicios/sesion';
import { UsuariosApi } from '../../../nucleo/servicios/usuarios-api';
import { DialogoRestablecerClave } from './dialogo-restablecer-clave';
import { DatosDialogoUsuario, DialogoUsuario } from './dialogo-usuario';

type Estado = 'todos' | 'activos' | 'inactivos';

/** Administración de usuarios: listado con búsqueda, filtros y paginación del lado del servidor. */
@Component({
  selector: 'app-usuarios',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressBarModule,
    Avatar,
    BytesPipe,
  ],
  providers: [proveerPaginadorEs],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Usuarios {
  private readonly api = inject(UsuariosApi);
  private readonly dialogo = inject(MatDialog);
  private readonly notificador = inject(Notificador);
  private readonly sesion = inject(Sesion);
  protected readonly idActual = computed(() => this.sesion.usuario()?._id ?? '');

  protected readonly columnas = ['usuario', 'correo', 'rol', 'estado', 'almacenamiento', 'ultimoAcceso', 'acciones'];

  // ---------- Filtros ----------
  protected readonly busqueda = new FormControl('', { nonNullable: true });
  private readonly textoBuscado = toSignal(
    this.busqueda.valueChanges.pipe(debounceTime(300), map((t) => t.trim()), distinctUntilChanged()),
    { initialValue: '' },
  );
  protected readonly rol = signal<Rol | 'todos'>('todos');
  protected readonly estado = signal<Estado>('todos');
  protected readonly pagina = signal(0); // índice del paginador (base 0)
  protected readonly limite = signal(10);
  private readonly recarga = signal(0);

  private readonly filtro = computed(() => ({
    buscar: this.textoBuscado() || undefined,
    rol: this.rol() === 'todos' ? undefined : (this.rol() as Rol),
    activo: this.estado() === 'todos' ? undefined : this.estado() === 'activos',
    pagina: this.pagina() + 1,
    limite: this.limite(),
    recarga: this.recarga(),
  }));

  // ---------- Datos ----------
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  private readonly respuesta = toSignal(
    toObservable(this.filtro).pipe(
      tap(() => this.cargando.set(true)),
      switchMap(({ recarga: _recarga, ...filtro }) =>
        this.api.listar(filtro).pipe(
          tap(() => this.errorCarga.set(null)),
          catchError((error: unknown) => {
            this.errorCarga.set(error instanceof ErrorApi ? error.message : 'No se pudieron cargar los usuarios.');
            return of<Paginado<Usuario> | null>(null);
          }),
        ),
      ),
      tap(() => this.cargando.set(false)),
      startWith(null),
    ),
  );
  protected readonly usuarios = computed(() => this.respuesta()?.datos ?? []);
  protected readonly total = computed(() => this.respuesta()?.total ?? 0);

  protected cambiarRol(valor: Rol | 'todos'): void {
    this.rol.set(valor);
    this.pagina.set(0);
  }

  protected cambiarEstado(valor: Estado): void {
    this.estado.set(valor);
    this.pagina.set(0);
  }

  constructor() {
    // Una búsqueda nueva vuelve a la primera página.
    this.busqueda.valueChanges.subscribe(() => this.pagina.set(0));
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.limite.set(evento.pageSize);
    this.pagina.set(evento.pageIndex);
  }

  protected porcentaje(usuario: Usuario): number {
    const { usadoBytes, cuotaBytes } = usuario.almacenamiento;
    return cuotaBytes ? Math.min(100, (usadoBytes / cuotaBytes) * 100) : 0;
  }

  private recargar(): void {
    this.recarga.update((n) => n + 1);
  }

  // ---------- Acciones ----------
  protected nuevo(): void {
    this.abrirDialogoUsuario({ idActual: this.idActual() }).subscribe((creado) => {
      if (!creado) return;
      this.notificador.exito(`Usuario ${creado.nombreUsuario} creado.`);
      this.recargar();
    });
  }

  protected editar(usuario: Usuario): void {
    this.abrirDialogoUsuario({ usuario, idActual: this.idActual() }).subscribe((actualizado) => {
      if (!actualizado) return;
      this.notificador.exito('Cambios guardados.');
      this.recargar();
    });
  }

  protected restablecerClave(usuario: Usuario): void {
    this.dialogo
      .open<DialogoRestablecerClave, Usuario, boolean>(DialogoRestablecerClave, { data: usuario })
      .afterClosed()
      .subscribe((hecho) => {
        if (hecho) this.notificador.exito(`Contraseña de ${usuario.nombreUsuario} restablecida.`);
      });
  }

  protected alternarEstado(usuario: Usuario): void {
    const desactivar = usuario.activo;
    const datos: DatosConfirmacion = desactivar
      ? {
          titulo: 'Desactivar usuario',
          mensaje: `${usuario.nombreCompleto} no podrá iniciar sesión y sus sesiones abiertas se cerrarán. Sus archivos y su historial se conservan.`,
          textoConfirmar: 'Desactivar',
          peligroso: true,
        }
      : {
          titulo: 'Activar usuario',
          mensaje: `${usuario.nombreCompleto} podrá volver a iniciar sesión.`,
          textoConfirmar: 'Activar',
        };

    this.dialogo
      .open<DialogoConfirmacion, DatosConfirmacion, boolean>(DialogoConfirmacion, { data: datos })
      .afterClosed()
      .pipe(switchMap((confirmado) => (confirmado ? this.api.cambiarEstado(usuario._id, !desactivar) : of(null))))
      .subscribe({
        next: (resultado) => {
          if (!resultado) return;
          this.notificador.exito(desactivar ? 'Usuario desactivado.' : 'Usuario activado.');
          this.recargar();
        },
        error: (error: unknown) => this.notificador.error(error),
      });
  }

  private abrirDialogoUsuario(datos: DatosDialogoUsuario) {
    return this.dialogo
      .open<DialogoUsuario, DatosDialogoUsuario, Usuario>(DialogoUsuario, { data: datos, width: '600px', maxWidth: '95vw' })
      .afterClosed();
  }
}
