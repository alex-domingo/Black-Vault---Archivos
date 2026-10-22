import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EstadoSalud } from '../modelos/salud';

/** Consulta el estado del servidor y de MongoDB (GET /api/salud). */
@Injectable({ providedIn: 'root' })
export class SaludApi {
  private readonly http = inject(HttpClient);

  consultar(): Observable<EstadoSalud> {
    return this.http.get<EstadoSalud>(`${environment.urlApi}/salud`);
  }
}
