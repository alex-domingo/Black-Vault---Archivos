import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaSesion, Usuario } from '../modelos/usuario';

/** Endpoints de /api/autenticacion. El estado de la sesión vive en el servicio Sesion. */
@Injectable({ providedIn: 'root' })
export class AutenticacionApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.urlApi}/autenticacion`;

  iniciarSesion(identificador: string, clave: string): Observable<RespuestaSesion> {
    return this.http.post<RespuestaSesion>(`${this.url}/iniciar-sesion`, { identificador, clave });
  }

  perfil(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.url}/perfil`);
  }

  cambiarClave(claveActual: string, claveNueva: string): Observable<RespuestaSesion> {
    return this.http.patch<RespuestaSesion>(`${this.url}/clave`, { claveActual, claveNueva });
  }

  cerrarSesion(): Observable<void> {
    return this.http.post<void>(`${this.url}/cerrar-sesion`, {});
  }
}
