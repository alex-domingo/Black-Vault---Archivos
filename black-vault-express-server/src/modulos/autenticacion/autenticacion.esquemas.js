import { z } from 'zod';
import { objeto } from '../../middlewares/validar.js';
import { esquemaClave } from '../../servicios/claves.js';

export const cuerpoIniciarSesion = objeto({
  // Nombre de usuario o correo.
  identificador: z
    .string({ error: 'Escribe tu usuario o correo.' })
    .trim()
    .toLowerCase()
    .min(1, 'Escribe tu usuario o correo.')
    .max(254),
  clave: z.string({ error: 'Escribe tu contraseña.' }).min(1, 'Escribe tu contraseña.').max(200),
});

export const cuerpoCambiarClave = objeto({
  claveActual: z.string({ error: 'Escribe tu contraseña actual.' }).min(1, 'Escribe tu contraseña actual.').max(200),
  claveNueva: esquemaClave,
});
