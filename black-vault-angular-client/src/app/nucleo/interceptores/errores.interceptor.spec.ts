import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ErrorApi } from '../modelos/error-api';
import { interceptorErrores } from './errores.interceptor';

describe('interceptorErrores', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([interceptorErrores])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
  });

  async function errorDe(responder: (url: string) => void): Promise<ErrorApi> {
    const promesa = firstValueFrom(http.get('/api/prueba')).catch((error: unknown) => error);
    responder('/api/prueba');
    const error = await promesa;
    expect(error).toBeInstanceOf(ErrorApi);
    return error as ErrorApi;
  }

  it('usa el código y el mensaje del formato de error de la API', async () => {
    const error = await errorDe((url) =>
      controlador
        .expectOne(url)
        .flush({ error: { codigo: 'CONFLICTO', mensaje: 'Ya existe una carpeta con ese nombre.' } }, { status: 409, statusText: 'Conflict' }),
    );
    expect(error.estado).toBe(409);
    expect(error.codigo).toBe('CONFLICTO');
    expect(error.message).toBe('Ya existe una carpeta con ese nombre.');
  });

  it('traduce la falta de conexión a SIN_CONEXION', async () => {
    const error = await errorDe((url) => controlador.expectOne(url).error(new ProgressEvent('error'), { status: 0 }));
    expect(error.codigo).toBe('SIN_CONEXION');
  });

  it('tolera respuestas de error sin el formato de la API', async () => {
    const error = await errorDe((url) => controlador.expectOne(url).flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' }));
    expect(error.codigo).toBe('ERROR_DESCONOCIDO');
    expect(error.estado).toBe(502);
  });
});
