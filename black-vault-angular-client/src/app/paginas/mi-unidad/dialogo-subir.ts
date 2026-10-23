import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { lastValueFrom, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CampoEtiquetas } from '../../compartido/componentes/campo-etiquetas/campo-etiquetas';
import { BytesPipe } from '../../compartido/pipes/bytes.pipe';
import { CATEGORIAS, Categoria } from '../../nucleo/modelos/documentos';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { ArchivosApi } from '../../nucleo/servicios/archivos-api';

export interface DatosDialogoSubir {
  archivos: File[];
  carpetaId: string | null;
  nombreDestino: string;
}

type Estado = 'pendiente' | 'subiendo' | 'listo' | 'error' | 'rechazado';

interface Fila {
  archivo: File;
  estado: Estado;
  progreso: number;
  mensaje?: string;
  nombreFinal?: string;
}

const EXTENSIONES = ['.txt', '.md'];

/** Elige la clasificación y sube los archivos uno por uno, mostrando el progreso. */
@Component({
  selector: 'app-dialogo-subir',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    CampoEtiquetas,
    BytesPipe,
  ],
  templateUrl: './dialogo-subir.html',
  styleUrl: './dialogo-subir.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoSubir {
  private readonly api = inject(ArchivosApi);
  private readonly referencia = inject(MatDialogRef<DialogoSubir, number>);
  protected readonly datos = inject<DatosDialogoSubir>(MAT_DIALOG_DATA);
  protected readonly categorias = CATEGORIAS;
  protected readonly tamanoMaximo = environment.tamanoMaximoMb * 1024 * 1024;

  protected readonly filas = signal<Fila[]>(this.datos.archivos.map((archivo) => this.validar(archivo)));
  protected readonly enCurso = signal(false);
  protected readonly terminado = signal(false);
  protected readonly validos = computed(() => this.filas().filter((f) => f.estado !== 'rechazado').length);
  protected readonly subidos = computed(() => this.filas().filter((f) => f.estado === 'listo').length);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    categoria: ['otro' as Categoria, Validators.required],
    descripcion: ['', Validators.maxLength(500)],
  });
  protected readonly etiquetas = new FormControl<string[]>([], { nonNullable: true });

  /** Validación previa en el navegador; el servidor vuelve a validar todo. */
  private validar(archivo: File): Fila {
    const nombre = archivo.name.toLowerCase();
    if (!EXTENSIONES.some((e) => nombre.endsWith(e))) {
      return { archivo, estado: 'rechazado', progreso: 0, mensaje: 'Solo se permiten .txt y .md' };
    }
    if (archivo.size > this.tamanoMaximo) {
      return { archivo, estado: 'rechazado', progreso: 0, mensaje: `Supera ${environment.tamanoMaximoMb} MB` };
    }
    return { archivo, estado: 'pendiente', progreso: 0 };
  }

  private actualizar(indice: number, cambios: Partial<Fila>): void {
    this.filas.update((filas) => filas.map((f, i) => (i === indice ? { ...f, ...cambios } : f)));
  }

  protected async subir(): Promise<void> {
    if (this.formulario.invalid || this.enCurso()) return;
    this.enCurso.set(true);
    this.referencia.disableClose = true;
    const { categoria, descripcion } = this.formulario.getRawValue();

    // Secuencial: el progreso se entiende mejor y no se satura la API.
    for (const [indice, fila] of this.filas().entries()) {
      if (fila.estado !== 'pendiente') continue;
      this.actualizar(indice, { estado: 'subiendo' });
      try {
        const respuesta = await lastValueFrom(
          this.api
            .subir(fila.archivo, { carpetaId: this.datos.carpetaId, categoria, etiquetas: this.etiquetas.value, descripcion: descripcion.trim() })
            .pipe(
              tap((evento) => {
                if (evento.type === HttpEventType.UploadProgress && evento.total) {
                  this.actualizar(indice, { progreso: Math.round((evento.loaded / evento.total) * 100) });
                }
              }),
            ),
        );
        const archivo = respuesta.type === HttpEventType.Response ? respuesta.body : null;
        this.actualizar(indice, { estado: 'listo', progreso: 100, nombreFinal: archivo?.nombre });
      } catch (error) {
        this.actualizar(indice, { estado: 'error', mensaje: error instanceof ErrorApi ? error.message : 'No se pudo subir.' });
      }
    }

    this.enCurso.set(false);
    this.terminado.set(true);
    this.referencia.disableClose = false;
  }

  protected cerrar(): void {
    this.referencia.close(this.subidos());
  }
}
