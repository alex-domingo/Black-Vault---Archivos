import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Actividad, FiltroActividad } from '../modelos/actividad';
import { TipoRecurso } from '../modelos/comparticiones';
import { InformeIntegridad } from '../modelos/integridad';
import { Paginado } from '../modelos/usuario';

/** Historial (/api/actividades) y verificación de integridad (/api/mantenimiento). */
@Injectable({ providedIn: 'root' })
export class ActividadesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.urlApi}/actividades`;

  listar(filtro: FiltroActividad): Observable<Paginado<Actividad>> {
    return this.http.get<Paginado<Actividad>>(this.url, { params: aParametros(filtro) });
  }

  deRecurso(tipo: TipoRecurso, id: string, filtro: FiltroActividad): Observable<Paginado<Actividad>> {
    return this.http.get<Paginado<Actividad>>(`${this.url}/recurso/${tipo}/${id}`, { params: aParametros(filtro) });
  }

  integridad(): Observable<InformeIntegridad> {
    return this.http.get<InformeIntegridad>(`${environment.urlApi}/mantenimiento/integridad`);
  }
}

function aParametros(filtro: FiltroActividad): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== null && valor !== '') params = params.set(clave, String(valor));
  }
  return params;
}
