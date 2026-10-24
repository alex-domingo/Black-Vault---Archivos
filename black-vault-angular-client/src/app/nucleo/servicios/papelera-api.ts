import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TipoRecurso } from '../modelos/comparticiones';
import { ElementoPapelera, FiltroPapelera, ResultadoEliminacion, ResultadoEnvio, ResultadoRestauracion } from '../modelos/papelera';
import { Paginado } from '../modelos/usuario';

/** Enviar a la papelera (DELETE /archivos/:id, /carpetas/:id) y endpoints de /api/papelera. */
@Injectable({ providedIn: 'root' })
export class PapeleraApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.urlApi}/papelera`;

  enviar(tipo: TipoRecurso, id: string): Observable<ResultadoEnvio> {
    const coleccion = tipo === 'archivo' ? 'archivos' : 'carpetas';
    return this.http.delete<ResultadoEnvio>(`${environment.urlApi}/${coleccion}/${id}`);
  }

  listar(filtro: FiltroPapelera): Observable<Paginado<ElementoPapelera>> {
    let params = new HttpParams().set('pagina', filtro.pagina).set('limite', filtro.limite);
    if (filtro.tipo) params = params.set('tipo', filtro.tipo);
    if (filtro.buscar) params = params.set('buscar', filtro.buscar);
    return this.http.get<Paginado<ElementoPapelera>>(this.url, { params });
  }

  restaurar(tipo: TipoRecurso, id: string): Observable<ResultadoRestauracion> {
    return this.http.post<ResultadoRestauracion>(`${this.url}/${tipo}/${id}/restaurar`, {});
  }

  eliminar(tipo: TipoRecurso, id: string): Observable<ResultadoEliminacion> {
    return this.http.delete<ResultadoEliminacion>(`${this.url}/${tipo}/${id}`);
  }

  vaciar(): Observable<ResultadoEliminacion> {
    return this.http.delete<ResultadoEliminacion>(this.url);
  }
}
