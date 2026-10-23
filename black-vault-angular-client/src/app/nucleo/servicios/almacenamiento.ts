import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EstadoAlmacenamiento } from '../modelos/documentos';

/** Espacio usado por el usuario. Se refresca después de subir o editar archivos. */
@Injectable({ providedIn: 'root' })
export class Almacenamiento {
  private readonly http = inject(HttpClient);
  private readonly estadoActual = signal<EstadoAlmacenamiento | null>(null);

  readonly estado = this.estadoActual.asReadonly();
  readonly porcentaje = computed(() => {
    const e = this.estadoActual();
    return e && e.cuotaBytes ? Math.min(100, (e.usadoBytes / e.cuotaBytes) * 100) : 0;
  });

  refrescar(): void {
    this.http.get<EstadoAlmacenamiento>(`${environment.urlApi}/almacenamiento`).subscribe({
      next: (estado) => this.estadoActual.set(estado),
      error: () => undefined, // el indicador no es crítico
    });
  }

  limpiar(): void {
    this.estadoActual.set(null);
  }
}
