import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CambiosUsuario,
  DatosNuevoUsuario,
  FiltroUsuarios,
  Paginado,
  Usuario,
  UsuarioDirectorio,
} from '../modelos/usuario';

/** Endpoints de /api/usuarios (administración y directorio). */
@Injectable({ providedIn: 'root' })
export class UsuariosApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.urlApi}/usuarios`;

  listar(filtro: FiltroUsuarios): Observable<Paginado<Usuario>> {
    let params = new HttpParams().set('pagina', filtro.pagina).set('limite', filtro.limite);
    if (filtro.buscar) params = params.set('buscar', filtro.buscar);
    if (filtro.rol) params = params.set('rol', filtro.rol);
    if (filtro.activo !== undefined) params = params.set('activo', String(filtro.activo));
    return this.http.get<Paginado<Usuario>>(this.url, { params });
  }

  crear(datos: DatosNuevoUsuario): Observable<Usuario> {
    return this.http.post<Usuario>(this.url, datos);
  }

  actualizar(id: string, cambios: CambiosUsuario): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.url}/${id}`, cambios);
  }

  cambiarEstado(id: string, activo: boolean): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.url}/${id}/estado`, { activo });
  }

  restablecerClave(id: string, claveNueva: string): Observable<void> {
    return this.http.patch<void>(`${this.url}/${id}/clave`, { claveNueva });
  }

  directorio(buscar?: string): Observable<UsuarioDirectorio[]> {
    const params = buscar ? new HttpParams().set('buscar', buscar) : undefined;
    return this.http.get<UsuarioDirectorio[]>(`${this.url}/directorio`, { params });
  }
}
