import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { interceptorErrores } from '../interceptores/errores.interceptor';
import { interceptorToken } from '../interceptores/token.interceptor';
import { Usuario } from '../modelos/usuario';
import { Sesion } from './sesion';

const admin: Usuario = {
  _id: '6650000000000000000000a0',
  nombreUsuario: 'admin',
  correo: 'admin@blackvault.gt',
  nombreCompleto: 'Administrador del Sistema',
  rol: 'administrador',
  activo: true,
  almacenamiento: { usadoBytes: 0, cuotaBytes: 500 * 1024 * 1024 },
  ultimoAcceso: null,
  desactivadoEn: null,
  creadoEn: '2026-05-04T14:00:00.000Z',
  actualizadoEn: '2026-05-04T14:00:00.000Z',
};

describe('Sesion e interceptorToken', () => {
  let sesion: Sesion;
  let http: HttpTestingController;
  const url = environment.urlApi;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([interceptorToken, interceptorErrores])),
        provideHttpClientTesting(),
      ],
    });
    sesion = TestBed.inject(Sesion);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('iniciar sesión guarda el token y el usuario', async () => {
    const promesa = firstValueFrom(sesion.iniciarSesion('admin', 'Admin2026'));
    const peticion = http.expectOne(`${url}/autenticacion/iniciar-sesion`);
    expect(peticion.request.body).toEqual({ identificador: 'admin', clave: 'Admin2026' });
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush({ token: 'abc', expiraEn: '2026-10-22T15:00:00.000Z', usuario: admin });
    await promesa;

    expect(sesion.token()).toBe('abc');
    expect(sesion.autenticado()).toBe(true);
    expect(sesion.esAdministrador()).toBe(true);
    expect(localStorage.getItem('black-vault.token')).toBe('abc');
  });

  it('agrega el token solo a las peticiones de la API', async () => {
    sesion.establecer({ token: 'abc', expiraEn: '', usuario: admin });
    const cliente = TestBed.inject(HttpClient);
    void firstValueFrom(cliente.get(`${url}/usuarios`)).catch(() => undefined);
    void firstValueFrom(cliente.get('https://otro-sitio.com/datos')).catch(() => undefined);
    expect(http.expectOne(`${url}/usuarios`).request.headers.get('Authorization')).toBe('Bearer abc');
    expect(http.expectOne('https://otro-sitio.com/datos').request.headers.has('Authorization')).toBe(false);
  });

  it('un 401 de la API cierra la sesión local y lleva al inicio de sesión', async () => {
    sesion.establecer({ token: 'abc', expiraEn: '', usuario: admin });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const promesa = firstValueFrom(TestBed.inject(HttpClient).get(`${url}/usuarios`)).catch((e: unknown) => e);
    http
      .expectOne(`${url}/usuarios`)
      .flush({ error: { codigo: 'SESION_INVALIDA', mensaje: 'Tu sesión ya no es válida.' } }, { status: 401, statusText: 'Unauthorized' });
    await promesa;

    expect(sesion.token()).toBeNull();
    expect(sesion.usuario()).toBeNull();
    expect(localStorage.getItem('black-vault.token')).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/iniciar-sesion'], expect.objectContaining({ queryParams: expect.objectContaining({ motivo: 'expirada' }) }));
  });

  it('asegurarUsuario: sin token no consulta al servidor', async () => {
    expect(await sesion.asegurarUsuario()).toBe(false);
  });

  it('asegurarUsuario: si el servidor no responde conserva el token', async () => {
    localStorage.setItem('black-vault.token', 'guardado');
    const nueva = TestBed.runInInjectionContext(() => new Sesion());
    const promesa = nueva.asegurarUsuario();
    http.expectOne(`${url}/autenticacion/perfil`).error(new ProgressEvent('error'), { status: 0 });
    expect(await promesa).toBe(false);
    expect(nueva.token()).toBe('guardado');
  });
});
