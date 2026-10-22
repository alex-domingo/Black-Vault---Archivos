import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEsGt from '@angular/common/locales/es-GT';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { interceptorErrores } from './nucleo/interceptores/errores.interceptor';
import { interceptorToken } from './nucleo/interceptores/token.interceptor';

// Formatos de fecha, número y moneda en español de Guatemala (pipes date, number, currency).
registerLocaleData(localeEsGt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // interceptorToken va primero (más externo): recibe los errores ya convertidos por interceptorErrores.
    provideHttpClient(withFetch(), withInterceptors([interceptorToken, interceptorErrores])),
    { provide: LOCALE_ID, useValue: 'es-GT' },
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-GT' },
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    // <mat-icon> usa la fuente Material Symbols Outlined (cargada en index.html).
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    }),
  ],
};
