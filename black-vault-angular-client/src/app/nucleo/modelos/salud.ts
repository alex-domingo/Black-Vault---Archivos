/** Respuesta de GET /api/salud. */
export interface EstadoSalud {
  estado: 'ok' | 'degradado';
  servidor: {
    nombre: string;
    node: string;
    entorno: string;
    zonaHoraria: string;
    activoDesdeSeg: number;
  };
  baseDatos: {
    conectada: boolean;
    nombre?: string;
    version?: string;
    latenciaMs?: number;
    transacciones?: boolean;
    error?: string;
  };
  fecha: string;
}
