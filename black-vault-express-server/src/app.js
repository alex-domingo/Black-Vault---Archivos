// Aplicación Express: seguridad, CORS, lectura de JSON, rutas y manejo de errores.
// Se separa de servidor.js para poder probarla con supertest sin abrir un puerto.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { entorno } from './config/entorno.js';
import api from './rutas.js';
import { manejarErrores, rutaNoEncontrada } from './middlewares/manejarErrores.js';

export function crearApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: entorno.ORIGENES_CLIENTE,
      // Angular necesita leer el nombre del archivo en las descargas.
      exposedHeaders: ['Content-Disposition'],
    }),
  );

  if (entorno.NODE_ENV === 'development') app.use(morgan('dev'));

  // La edición de contenido viaja como JSON: el límite cubre un archivo del tamaño
  // máximo aunque el escape de caracteres lo haga crecer.
  app.use(express.json({ limit: `${entorno.TAMANO_MAXIMO_MB * 2}mb` }));

  app.use('/api', api);

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);

  return app;
}
