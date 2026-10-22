import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { interceptorErrores } from './nucleo/interceptores/errores.interceptor';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withInterceptors([interceptorErrores])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('se crea', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('la raíz redirige a Mi unidad dentro del contenedor', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    const html = harness.routeNativeElement?.ownerDocument.body as HTMLElement;
    expect(html.textContent).toContain('Black Vault');
    expect(html.querySelector('h1')?.textContent).toContain('Mi unidad');
  });

  it('una ruta inexistente muestra la página no encontrada', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/no-existe');
    expect(harness.routeNativeElement?.ownerDocument.body.textContent).toContain('Página no encontrada');
  });
});
