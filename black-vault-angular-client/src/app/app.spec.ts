import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../environments/environment';
import { App } from './app';
import { routes } from './app.routes';
import { interceptorErrores } from './nucleo/interceptores/errores.interceptor';
import { interceptorToken } from './nucleo/interceptores/token.interceptor';
import { Usuario } from './nucleo/modelos/usuario';

const usuarioDePrueba = (datos: Partial<Usuario> = {}): Usuario => ({
  _id: '6650000000000000000000a1',
  nombreUsuario: 'mlopez',
  correo: 'mlopez@blackvault.gt',
  nombreCompleto: 'María Fernanda López',
  rol: 'usuario',
  activo: true,
  almacenamiento: { usadoBytes: 1024, cuotaBytes: 100 * 1024 * 1024 },
  ultimoAcceso: null,
  desactivadoEn: null,
  creadoEn: '2026-05-04T15:15:00.000Z',
  actualizadoEn: '2026-05-04T15:15:00.000Z',
  ...datos,
});

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withInterceptors([interceptorToken, interceptorErrores])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('se crea', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sin sesión, la raíz lleva al inicio de sesión recordando a dónde se quería ir', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/administracion/usuarios');
    expect(TestBed.inject(Router).url).toBe('/iniciar-sesion?volver=%2Fadministracion%2Fusuarios');
    expect(harness.routeNativeElement?.textContent).toContain('Iniciar sesión');
  });

  it('con un token guardado, carga el perfil y muestra Mi unidad dentro del contenedor', async () => {
    localStorage.setItem('black-vault.token', 'token-de-prueba');
    const http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    const navegacion = harness.navigateByUrl('/');
    await new Promise((r) => setTimeout(r));
    const peticion = http.expectOne(`${environment.urlApi}/autenticacion/perfil`);
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    peticion.flush(usuarioDePrueba());
    await navegacion;
    const cuerpo = harness.routeNativeElement?.ownerDocument.body as HTMLElement;
    expect(cuerpo.querySelector('h1')?.textContent).toContain('Mi unidad');
    expect(cuerpo.textContent).not.toContain('Administración');
  });
});
