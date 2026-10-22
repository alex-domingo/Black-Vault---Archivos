import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { CuerpoErrorApi, ErrorApi } from '../modelos/error-api';

/**
 * Convierte cualquier error HTTP en un ErrorApi con un mensaje en español,
 * para que los componentes no tengan que interpretar HttpErrorResponse.
 */
export const interceptorErrores: HttpInterceptorFn = (peticion, siguiente) =>
  siguiente(peticion).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

      if (error.status === 0) {
        return throwError(
          () => new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Verifica que la API esté en ejecución.'),
        );
      }

      const cuerpo = error.error as Partial<CuerpoErrorApi> | null;
      if (cuerpo?.error?.codigo) {
        return throwError(
          () => new ErrorApi(error.status, cuerpo.error!.codigo, cuerpo.error!.mensaje, cuerpo.error!.detalles),
        );
      }

      return throwError(
        () => new ErrorApi(error.status, 'ERROR_DESCONOCIDO', `El servidor respondió con un error (${error.status}).`),
      );
    }),
  );
