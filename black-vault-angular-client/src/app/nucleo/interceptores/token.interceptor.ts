import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ErrorApi } from '../modelos/error-api';
import { Sesion } from '../servicios/sesion';

/**
 * Agrega "Authorization: Bearer <token>" a las peticiones dirigidas a la API
 * y cierra la sesión local si el servidor responde que ya no es válida.
 * Va antes de interceptorErrores, así que recibe los errores ya convertidos en ErrorApi.
 */
export const interceptorToken: HttpInterceptorFn = (peticion, siguiente) => {
  const sesion = inject(Sesion);
  const token = sesion.token();
  const esApi = peticion.url.startsWith(environment.urlApi);
  const esInicioSesion = peticion.url.endsWith('/autenticacion/iniciar-sesion');

  const conToken = esApi && token ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : peticion;

  return siguiente(conToken).pipe(
    catchError((error: unknown) => {
      if (esApi && !esInicioSesion && error instanceof ErrorApi && error.estado === 401) {
        sesion.expirar();
      }
      return throwError(() => error);
    }),
  );
};
