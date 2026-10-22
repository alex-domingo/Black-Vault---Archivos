import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { interceptorErrores } from '../../nucleo/interceptores/errores.interceptor';
import { EstadoSalud } from '../../nucleo/modelos/salud';
import { IndicadorServidor } from './indicador-servidor';

const saludOk: EstadoSalud = {
  estado: 'ok',
  servidor: { nombre: 'Black Vault API', node: 'v24.12.0', entorno: 'development', zonaHoraria: 'America/Guatemala', activoDesdeSeg: 5 },
  baseDatos: { conectada: true, nombre: 'black_vault', version: '9.0.4', latenciaMs: 1.2, transacciones: false },
  fecha: '2026-10-22T06:00:00.000Z',
};

describe('IndicadorServidor', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IndicadorServidor],
      providers: [provideHttpClient(withInterceptors([interceptorErrores])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  /** El primer timer(0) se dispara en la siguiente vuelta del event loop. */
  const esperarConsulta = () => new Promise((resolver) => setTimeout(resolver));

  it('muestra "Conectado" cuando la API y MongoDB responden', async () => {
    const fixture = TestBed.createComponent(IndicadorServidor);
    fixture.detectChanges();
    await esperarConsulta();
    http.expectOne(`${environment.urlApi}/salud`).flush(saludOk);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Conectado');
  });

  it('muestra "Sin conexión" cuando el servidor no responde', async () => {
    const fixture = TestBed.createComponent(IndicadorServidor);
    fixture.detectChanges();
    await esperarConsulta();
    http.expectOne(`${environment.urlApi}/salud`).error(new ProgressEvent('error'), { status: 0 });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Sin conexión');
  });
});
