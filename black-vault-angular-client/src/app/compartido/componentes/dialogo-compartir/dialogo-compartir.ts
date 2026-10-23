import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, startWith, switchMap } from 'rxjs';
import { AccesoRecurso, Comparticion, PERMISOS, Permiso, TipoRecurso } from '../../../nucleo/modelos/comparticiones';
import { NIVEL_NUMERICO } from '../../../nucleo/modelos/documentos';
import { ErrorApi } from '../../../nucleo/modelos/error-api';
import { UsuarioDirectorio } from '../../../nucleo/modelos/usuario';
import { ComparticionesApi } from '../../../nucleo/servicios/comparticiones-api';
import { Notificador } from '../../../nucleo/servicios/notificador';
import { Sesion } from '../../../nucleo/servicios/sesion';
import { UsuariosApi } from '../../../nucleo/servicios/usuarios-api';
import { Avatar } from '../avatar/avatar';

export interface DatosDialogoCompartir {
  tipo: TipoRecurso;
  id: string;
  nombre: string;
}

const etiquetaPermiso = (permiso: Permiso) => PERMISOS.find((p) => p.valor === permiso)?.etiqueta ?? permiso;

/**
 * Compartir un archivo o una carpeta propios: agregar personas, cambiar su permiso o quitarlo,
 * y ver el acceso que llega heredado de las carpetas que lo contienen.
 * Los cambios se guardan al instante; el diálogo se cierra con "Listo".
 */
@Component({
  selector: 'app-dialogo-compartir',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    Avatar,
  ],
  templateUrl: './dialogo-compartir.html',
  styleUrl: './dialogo-compartir.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoCompartir {
  protected readonly datos = inject<DatosDialogoCompartir>(MAT_DIALOG_DATA);
  private readonly api = inject(ComparticionesApi);
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly notificador = inject(Notificador);
  protected readonly yo = inject(Sesion).usuario;

  protected readonly permisos = PERMISOS;
  protected readonly etiquetaPermiso = etiquetaPermiso;

  protected readonly acceso = signal<AccesoRecurso | null>(null);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly compartiendo = signal(false);
  /** Comparticiones con una operación en curso (para deshabilitar sus controles). */
  protected readonly ocupadas = signal<ReadonlySet<string>>(new Set());

  protected readonly persona = new FormControl<string | UsuarioDirectorio>('', { nonNullable: true });
  protected readonly permisoNuevo = new FormControl<Permiso>('lectura', { nonNullable: true });
  /** Agrupa los campos para que (ngSubmit) funcione y no se envíe el formulario nativo (que recargaría la página). */
  protected readonly formulario = new FormGroup({ persona: this.persona, permiso: this.permisoNuevo });
  protected readonly elegido = signal<UsuarioDirectorio | null>(null);

  protected readonly sugerencias = toSignal(
    this.persona.valueChanges.pipe(
      startWith(''),
      filter((valor): valor is string => typeof valor === 'string'),
      map((texto) => texto.trim()),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((texto) => this.usuariosApi.directorio(texto || undefined).pipe(catchError(() => of<UsuarioDirectorio[]>([])))),
    ),
    { initialValue: [] as UsuarioDirectorio[] },
  );

  /** Personas que ya tienen una compartición directa (no se pueden agregar otra vez). */
  protected readonly conAccesoDirecto = computed(
    () => new Set((this.acceso()?.directas ?? []).map((c) => c.destinatario?._id).filter((id): id is string => !!id)),
  );

  /** Para cada persona, el mayor acceso heredado (para avisar si supera al directo). */
  protected readonly mejorHeredado = computed(() => {
    const mapa = new Map<string, { permiso: Permiso; desde: string }>();
    for (const h of this.acceso()?.heredadas ?? []) {
      const id = h.destinatario?._id;
      if (!id) continue;
      const actual = mapa.get(id);
      if (!actual || NIVEL_NUMERICO[h.permiso] > NIVEL_NUMERICO[actual.permiso]) mapa.set(id, { permiso: h.permiso, desde: h.desde.nombre });
    }
    return mapa;
  });

  constructor() {
    this.cargar();
    // Si se escribe después de elegir, la elección deja de valer.
    this.persona.valueChanges.subscribe((valor) => {
      if (typeof valor === 'string') this.elegido.set(null);
    });
  }

  private cargar(): void {
    this.api.acceso(this.datos.tipo, this.datos.id).subscribe({
      next: (acceso) => {
        this.acceso.set(acceso);
        this.errorCarga.set(null);
      },
      error: (error: unknown) => this.errorCarga.set(error instanceof ErrorApi ? error.message : 'No se pudo cargar quién tiene acceso.'),
    });
  }

  protected readonly mostrarPersona = (valor: string | UsuarioDirectorio | null): string =>
    typeof valor === 'string' ? valor : (valor?.nombreCompleto ?? '');

  protected elegir(usuario: UsuarioDirectorio): void {
    this.elegido.set(usuario);
    this.error.set(null);
  }

  protected heredadoSuperior(c: Comparticion): { permiso: Permiso; desde: string } | null {
    const heredado = c.destinatario ? this.mejorHeredado().get(c.destinatario._id) : undefined;
    return heredado && NIVEL_NUMERICO[heredado.permiso] > NIVEL_NUMERICO[c.permiso] ? heredado : null;
  }

  protected compartir(): void {
    const persona = this.elegido();
    if (!persona) {
      this.error.set('Elige a una persona de la lista.');
      return;
    }
    if (this.compartiendo()) return;
    this.compartiendo.set(true);
    this.error.set(null);
    this.api.crear(this.datos.tipo, this.datos.id, persona._id, this.permisoNuevo.value).subscribe({
      next: (nueva) => {
        this.compartiendo.set(false);
        this.persona.setValue('');
        this.elegido.set(null);
        this.notificador.exito(`Compartido con ${persona.nombreCompleto}.`);
        this.acceso.update((a) => (a ? { ...a, directas: [...a.directas, nueva].sort(porNombre) } : a));
      },
      error: (error: unknown) => {
        this.compartiendo.set(false);
        this.error.set(error instanceof ErrorApi ? error.message : 'No se pudo compartir.');
      },
    });
  }

  protected cambiarPermiso(c: Comparticion, permiso: Permiso): void {
    if (c.permiso === permiso) return;
    this.marcar(c._id, true);
    this.api.modificar(c._id, permiso).subscribe({
      next: (actualizada) => {
        this.marcar(c._id, false);
        this.reemplazar(c._id, (lista) => lista.map((x) => (x._id === c._id ? actualizada : x)));
        this.notificador.exito(`${c.destinatario?.nombreCompleto ?? 'La persona'} ahora tiene permiso de ${etiquetaPermiso(permiso).toLowerCase()}.`);
      },
      error: (error: unknown) => {
        this.marcar(c._id, false);
        this.notificador.error(error, 'No se pudo cambiar el permiso.');
      },
    });
  }

  protected retirar(c: Comparticion): void {
    this.marcar(c._id, true);
    this.api.retirar(c._id).subscribe({
      next: () => {
        this.marcar(c._id, false);
        this.reemplazar(c._id, (lista) => lista.filter((x) => x._id !== c._id));
        this.notificador.exito(`Se quitó el acceso de ${c.destinatario?.nombreCompleto ?? 'la persona'}.`);
      },
      error: (error: unknown) => {
        this.marcar(c._id, false);
        this.notificador.error(error, 'No se pudo quitar el acceso.');
      },
    });
  }

  private reemplazar(_id: string, cambio: (lista: Comparticion[]) => Comparticion[]): void {
    this.acceso.update((a) => (a ? { ...a, directas: cambio(a.directas) } : a));
  }

  private marcar(id: string, ocupada: boolean): void {
    this.ocupadas.update((actual) => {
      const nuevo = new Set(actual);
      if (ocupada) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });
  }
}

function porNombre(a: Comparticion, b: Comparticion): number {
  return (a.destinatario?.nombreCompleto ?? '').localeCompare(b.destinatario?.nombreCompleto ?? '', 'es');
}
