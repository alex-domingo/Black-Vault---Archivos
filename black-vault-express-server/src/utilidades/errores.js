// Errores de la API con un formato uniforme:
// { "error": { "codigo": "NO_ENCONTRADO", "mensaje": "…", "detalles": … } }

export class ErrorApi extends Error {
  /**
   * @param {number} estado Código HTTP.
   * @param {string} codigo Código estable que el cliente puede interpretar.
   * @param {string} mensaje Mensaje para mostrar al usuario.
   * @param {unknown} [detalles] Información adicional (por ejemplo, errores de validación por campo).
   */
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export const errores = {
  validacion: (mensaje = 'Los datos enviados no son válidos.', detalles) => new ErrorApi(400, 'VALIDACION', mensaje, detalles),
  noAutenticado: (mensaje = 'Debes iniciar sesión.') => new ErrorApi(401, 'NO_AUTENTICADO', mensaje),
  prohibido: (mensaje = 'No tienes permiso para realizar esta acción.') => new ErrorApi(403, 'PROHIBIDO', mensaje),
  noEncontrado: (mensaje = 'El recurso solicitado no existe.') => new ErrorApi(404, 'NO_ENCONTRADO', mensaje),
  conflicto: (mensaje, detalles) => new ErrorApi(409, 'CONFLICTO', mensaje, detalles),
  cuotaExcedida: (mensaje = 'No tienes espacio de almacenamiento suficiente.', detalles) => new ErrorApi(409, 'CUOTA_EXCEDIDA', mensaje, detalles),
  demasiadoGrande: (mensaje = 'El archivo supera el tamaño máximo permitido.') => new ErrorApi(413, 'ARCHIVO_DEMASIADO_GRANDE', mensaje),
  tipoNoPermitido: (mensaje = 'Solo se permiten archivos .txt y .md.') => new ErrorApi(415, 'TIPO_NO_PERMITIDO', mensaje),
  noProcesable: (mensaje, detalles) => new ErrorApi(422, 'NO_PROCESABLE', mensaje, detalles),
};
