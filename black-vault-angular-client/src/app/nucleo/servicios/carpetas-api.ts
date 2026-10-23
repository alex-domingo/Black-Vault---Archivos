import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Carpeta, ContenidoCarpeta, DetalleCarpeta, NodoCarpeta, OrdenContenido } from '../modelos/documentos';

/** Endpoints de /api/carpetas. */
@Injectable({ providedIn: 'root' })
export class CarpetasApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.urlApi}/carpetas`;

  /** Contenido de la raíz (id nulo) o de una carpeta. */
  contenido(id: string | null, orden: OrdenContenido, direccion: 'asc' | 'desc'): Observable<ContenidoCarpeta> {
    const params = new HttpParams().set('orden', orden).set('direccion', direccion);
    const ruta = id ? `${this.url}/${id}/contenido` : `${this.url}/raiz/contenido`;
    return this.http.get<ContenidoCarpeta>(ruta, { params });
  }

  detalle(id: string): Observable<DetalleCarpeta> {
    return this.http.get<DetalleCarpeta>(`${this.url}/${id}`);
  }

  arbol(): Observable<NodoCarpeta[]> {
    return this.http.get<NodoCarpeta[]>(`${this.url}/arbol`);
  }

  crear(nombre: string, padreId: string | null): Observable<Carpeta> {
    return this.http.post<Carpeta>(this.url, { nombre, padreId });
  }

  renombrar(id: string, nombre: string): Observable<Carpeta> {
    return this.http.patch<Carpeta>(`${this.url}/${id}`, { nombre });
  }

  mover(id: string, destinoId: string | null): Observable<Carpeta> {
    return this.http.patch<Carpeta>(`${this.url}/${id}/mover`, { destinoId });
  }
}
