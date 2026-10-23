import { HttpClient, HttpEvent, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Archivo,
  Categoria,
  DetalleArchivo,
  FiltroBusqueda,
  ResultadoBusqueda,
  TextoArchivo,
} from '../modelos/documentos';
import { Paginado } from '../modelos/usuario';

export interface DatosSubida {
  carpetaId: string | null;
  categoria: Categoria;
  etiquetas: string[];
  descripcion: string;
}

export interface CambiosArchivo {
  nombre?: string;
  categoria?: Categoria;
  etiquetas?: string[];
  descripcion?: string;
}

/** Endpoints de /api/archivos. */
@Injectable({ providedIn: 'root' })
export class ArchivosApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.urlApi}/archivos`;

  /** Sube un archivo y emite los eventos de progreso (multipart/form-data). */
  subir(archivo: File, datos: DatosSubida): Observable<HttpEvent<Archivo>> {
    const formulario = new FormData();
    formulario.append('archivo', archivo, archivo.name);
    if (datos.carpetaId) formulario.append('carpetaId', datos.carpetaId);
    formulario.append('categoria', datos.categoria);
    formulario.append('etiquetas', JSON.stringify(datos.etiquetas));
    formulario.append('descripcion', datos.descripcion);
    return this.http.post<Archivo>(this.url, formulario, { reportProgress: true, observe: 'events' });
  }

  buscar(filtro: FiltroBusqueda): Observable<Paginado<ResultadoBusqueda>> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== null && valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<Paginado<ResultadoBusqueda>>(this.url, { params });
  }

  detalle(id: string): Observable<DetalleArchivo> {
    return this.http.get<DetalleArchivo>(`${this.url}/${id}`);
  }

  leerTexto(id: string): Observable<TextoArchivo> {
    return this.http.get<TextoArchivo>(`${this.url}/${id}/contenido`);
  }

  guardarTexto(id: string, contenido: string, versionEsperada: number): Observable<Archivo> {
    return this.http.put<Archivo>(`${this.url}/${id}/contenido`, { contenido, versionEsperada });
  }

  /** El token viaja en la cabecera, así que la descarga se pide como Blob y luego se guarda. */
  descargar(id: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.url}/${id}/descarga`, { responseType: 'blob', observe: 'response' });
  }

  actualizar(id: string, cambios: CambiosArchivo): Observable<Archivo> {
    return this.http.patch<Archivo>(`${this.url}/${id}`, cambios);
  }

  mover(id: string, destinoId: string | null): Observable<Archivo> {
    return this.http.patch<Archivo>(`${this.url}/${id}/mover`, { destinoId });
  }
}
