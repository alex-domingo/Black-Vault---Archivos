import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, map, of, switchMap, timer } from 'rxjs';
import { ErrorApi } from '../../nucleo/modelos/error-api';
import { EstadoSalud } from '../../nucleo/modelos/salud';
import { SaludApi } from '../../nucleo/servicios/salud-api';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'ok'; salud: EstadoSalud }
  | { tipo: 'error'; mensaje: string };

/** Intervalo entre consultas al endpoint de salud. */
export const INTERVALO_SALUD_MS = 30_000;

/** Muestra si la API y MongoDB responden. Consulta /api/salud al iniciar y cada 30 segundos. */
@Component({
  selector: 'app-indicador-servidor',
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: './indicador-servidor.html',
  styleUrl: './indicador-servidor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadorServidor {
  private readonly saludApi = inject(SaludApi);

  protected readonly estado = toSignal(
    timer(0, INTERVALO_SALUD_MS).pipe(
      switchMap(() =>
        this.saludApi.consultar().pipe(
          map((salud): Estado => ({ tipo: 'ok', salud })),
          catchError((error: unknown) =>
            of<Estado>({
              tipo: 'error',
              mensaje:
                error instanceof ErrorApi && error.estado === 503
                  ? 'La API responde, pero MongoDB no está disponible.'
                  : error instanceof ErrorApi
                    ? error.message
                    : 'No se pudo consultar el estado del servidor.',
            }),
          ),
        ),
      ),
    ),
    { initialValue: { tipo: 'cargando' } as Estado },
  );

  protected readonly detalle = computed(() => {
    const estado = this.estado();
    if (estado.tipo !== 'ok') return estado.tipo === 'error' ? estado.mensaje : 'Consultando el servidor…';
    const { baseDatos, servidor } = estado.salud;
    const modo = baseDatos.transacciones ? 'con transacciones' : 'sin transacciones (standalone)';
    return `API en Node ${servidor.node} · MongoDB ${baseDatos.version} (${baseDatos.nombre}) · ${baseDatos.latenciaMs} ms · ${modo}`;
  });
}
