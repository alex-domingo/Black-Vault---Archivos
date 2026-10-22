import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { interceptorErrores } from '../../nucleo/interceptores/errores.interceptor';
import { InicioSesion } from './inicio-sesion';

describe('InicioSesion', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [InicioSesion],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([interceptorErrores])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => localStorage.clear());

  function escribir(elemento: HTMLElement, selector: string, valor: string): void {
    const input = elemento.querySelector<HTMLInputElement>(selector)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  it('no envía el formulario vacío', async () => {
    const fixture = TestBed.createComponent(InicioSesion);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    http.expectNone(`${environment.urlApi}/autenticacion/iniciar-sesion`);
    expect(fixture.nativeElement.textContent).toContain('Escribe tu usuario o correo.');
  });

  it('muestra el mensaje del servidor si las credenciales no son válidas', async () => {
    const fixture = TestBed.createComponent(InicioSesion);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;
    escribir(elemento, 'input[formcontrolname=identificador]', 'mlopez');
    escribir(elemento, 'input[formcontrolname=clave]', 'mala');
    elemento.querySelector<HTMLButtonElement>('button[type=submit]')!.click();

    http
      .expectOne(`${environment.urlApi}/autenticacion/iniciar-sesion`)
      .flush({ error: { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Usuario o contraseña incorrectos.' } }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    expect(elemento.querySelector('[role=alert]')?.textContent).toContain('Usuario o contraseña incorrectos.');
  });

  it('al entrar vuelve solo a rutas internas', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(InicioSesion);
    fixture.componentRef.setInput('volver', '//sitio-malicioso.com');
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;
    escribir(elemento, 'input[formcontrolname=identificador]', 'mlopez');
    escribir(elemento, 'input[formcontrolname=clave]', 'Usuario2026');
    elemento.querySelector<HTMLButtonElement>('button[type=submit]')!.click();

    http.expectOne(`${environment.urlApi}/autenticacion/iniciar-sesion`).flush({ token: 't', expiraEn: '', usuario: { rol: 'usuario' } });
    await fixture.whenStable();
    expect(navegar).toHaveBeenCalledWith('/mi-unidad');
  });

  it('avisa cuando la sesión anterior expiró', async () => {
    const fixture = TestBed.createComponent(InicioSesion);
    fixture.componentRef.setInput('motivo', 'expirada');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Tu sesión terminó');
  });
});
