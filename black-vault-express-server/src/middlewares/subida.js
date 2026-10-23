// Recepción de un archivo con Multer en MEMORIA (memoryStorage): nunca se escribe en el
// disco del servidor; el buffer pasa directo a GridFS (requisito "Importante", p. 6).
import multer from 'multer';
import { entorno } from '../config/entorno.js';
import { errores } from '../utilidades/errores.js';

const multerUnArchivo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: entorno.TAMANO_MAXIMO_BYTES,
    files: 1,
    fields: 10,
    fieldSize: 16 * 1024,
  },
  // Por defecto Multer lee el nombre del archivo como latin1 y rompe tildes y eñes.
  defParamCharset: 'utf8',
}).single('archivo');

export function recibirArchivo(req, res, next) {
  multerUnArchivo(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(errores.demasiadoGrande(`El archivo supera el tamaño máximo de ${entorno.TAMANO_MAXIMO_MB} MB.`));
      }
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(errores.validacion('Envía un solo archivo en el campo "archivo".'));
      }
      return next(errores.validacion(`La subida no es válida (${error.code}).`));
    }
    return next(error);
  });
}
