/** Error normalizado de la API. El servidor responde { error: { codigo, mensaje, detalles } }. */
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

/** Forma del cuerpo de error que devuelve el servidor. */
export interface CuerpoErrorApi {
  error: { codigo: string; mensaje: string; detalles?: unknown };
}
