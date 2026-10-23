import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ComparticionesApi } from './comparticiones-api';

describe('ComparticionesApi', () => {
  let api: ComparticionesApi;
  let http: HttpTestingController;
  const url = `${environment.urlApi}/comparticiones`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ComparticionesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('comparte con el tipo, el recurso, la persona y el permiso', () => {
    api.crear('carpeta', 'c1', 'u2', 'edicion').subscribe();
    const peticion = http.expectOne(url);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ tipoRecurso: 'carpeta', recursoId: 'c1', destinatarioId: 'u2', permiso: 'edicion' });
    peticion.flush({});
  });

  it('cambia el permiso y lo retira por el id de la compartición', () => {
    api.modificar('s1', 'lectura').subscribe();
    const cambio = http.expectOne(`${url}/s1`);
    expect(cambio.request.method).toBe('PATCH');
    expect(cambio.request.body).toEqual({ permiso: 'lectura' });
    cambio.flush({});

    api.retirar('s1').subscribe();
    const retiro = http.expectOne(`${url}/s1`);
    expect(retiro.request.method).toBe('DELETE');
    retiro.flush(null);
  });

  it('envía solo los filtros que tienen valor', () => {
    api.conmigo({ pagina: 2, limite: 10 }).subscribe();
    const sinFiltros = http.expectOne((p) => p.url === `${url}/conmigo`);
    expect(sinFiltros.request.params.keys().sort()).toEqual(['limite', 'pagina']);
    expect(sinFiltros.request.params.get('pagina')).toBe('2');
    sinFiltros.flush({ datos: [], total: 0, pagina: 2, limite: 10 });

    api.realizadas({ tipo: 'archivo', buscar: 'plan', pagina: 1, limite: 20 }).subscribe();
    const conFiltros = http.expectOne((p) => p.url === `${url}/realizadas`);
    expect(conFiltros.request.params.get('tipo')).toBe('archivo');
    expect(conFiltros.request.params.get('buscar')).toBe('plan');
    conFiltros.flush({ datos: [], total: 0, pagina: 1, limite: 20 });
  });

  it('pide el acceso de un recurso por su tipo e id', () => {
    api.acceso('archivo', 'a1').subscribe();
    http.expectOne(`${url}/recurso/archivo/a1`).flush({ recurso: {}, directas: [], heredadas: [] });
  });
});
