import { Signal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { ErrorApi } from '../../../nucleo/modelos/error-api';

/**
 * Vuelve a pedir el reporte cada vez que cambia la consulta y expone datos, carga y error.
 * Mientras se recarga se conservan los datos anteriores (la tabla no parpadea).
 * Debe llamarse en el contexto de inyección (al construir el componente).
 */
export function cargarReporte<P, T>(consulta: Signal<P>, peticion: (p: P) => Observable<T | undefined>) {
  const cargando = signal(true);
  const error = signal<string | null>(null);
  const datos = toSignal(
    toObservable(consulta).pipe(
      debounceTime(150),
      tap(() => cargando.set(true)),
      switchMap((p) =>
        peticion(p).pipe(
          tap(() => error.set(null)),
          catchError((e: unknown) => {
            error.set(e instanceof ErrorApi ? e.message : 'No se pudo generar el reporte.');
            return of(undefined);
          }),
        ),
      ),
      tap(() => cargando.set(false)),
    ),
  );
  return { datos, cargando: cargando.asReadonly(), error: error.asReadonly() };
}
