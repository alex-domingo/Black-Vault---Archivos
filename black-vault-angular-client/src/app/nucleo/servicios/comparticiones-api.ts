import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccesoRecurso,
  Comparticion,
  CompartidoConmigo,
  CompartidoPorMi,
  FiltroCompartidos,
  Permiso,
  TipoRecurso,
} from '../modelos/comparticiones';
import { Paginado } from '../modelos/usuario';

/** Endpoints de /api/comparticiones. */
@Injectable({ providedIn: 'root' })
export class ComparticionesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.urlApi}/comparticiones`;

  /** Quién tiene acceso a un recurso propio (directo y heredado). */
  acceso(tipo: TipoRecurso, id: string): Observable<AccesoRecurso> {
    return this.http.get<AccesoRecurso>(`${this.url}/recurso/${tipo}/${id}`);
  }

  crear(tipoRecurso: TipoRecurso, recursoId: string, destinatarioId: string, permiso: Permiso): Observable<Comparticion> {
    return this.http.post<Comparticion>(this.url, { tipoRecurso, recursoId, destinatarioId, permiso });
  }

  modificar(id: string, permiso: Permiso): Observable<Comparticion> {
    return this.http.patch<Comparticion>(`${this.url}/${id}`, { permiso });
  }

  retirar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  conmigo(filtro: FiltroCompartidos): Observable<Paginado<CompartidoConmigo>> {
    return this.http.get<Paginado<CompartidoConmigo>>(`${this.url}/conmigo`, { params: this.parametros(filtro) });
  }

  realizadas(filtro: FiltroCompartidos): Observable<Paginado<CompartidoPorMi>> {
    return this.http.get<Paginado<CompartidoPorMi>>(`${this.url}/realizadas`, { params: this.parametros(filtro) });
  }

  private parametros(filtro: FiltroCompartidos): HttpParams {
    let params = new HttpParams().set('pagina', filtro.pagina).set('limite', filtro.limite);
    if (filtro.tipo) params = params.set('tipo', filtro.tipo);
    if (filtro.buscar) params = params.set('buscar', filtro.buscar);
    return params;
  }
}
