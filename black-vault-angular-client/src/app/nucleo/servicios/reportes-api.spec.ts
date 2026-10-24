import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ReportesApi } from './reportes-api';

describe('ReportesApi', () => {
  let api: ReportesApi;
  let http: HttpTestingController;
  const url = `${environment.urlApi}/reportes`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ReportesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía solo los filtros con valor', () => {
    api.archivosPorFecha({ desde: '2026-01-01', hasta: undefined, tipo: '', incluirPapelera: false, pagina: 1, limite: 10 }).subscribe();
    const peticion = http.expectOne((p) => p.url === `${url}/archivos-por-fecha`);
    expect(peticion.request.params.keys().sort()).toEqual(['desde', 'incluirPapelera', 'limite', 'pagina']);
    expect(peticion.request.params.get('incluirPapelera')).toBe('false');
    peticion.flush({ datos: [], total: 0, pagina: 1, limite: 10, bytes: 0, unidadSerie: 'dia', serie: [] });
  });

  it('usa el id del usuario en la ruta de los reportes por usuario', () => {
    api.recibidosPorUsuario('u1', { pagina: 1, limite: 10 }).subscribe();
    http.expectOne((p) => p.url === `${url}/recibidos-por-usuario/u1`).flush({});
    api.actividadUsuario('u2', { categoria: 'archivos', pagina: 1, limite: 20 }).subscribe();
    const actividad = http.expectOne((p) => p.url === `${url}/actividad-usuario/u2`);
    expect(actividad.request.params.get('categoria')).toBe('archivos');
    actividad.flush({});
  });
});
