/** Respuesta de GET /mantenimiento/integridad. */
export interface InformeIntegridad {
  revisadoEn: string;
  correcto: boolean;
  verificaciones: {
    clave: 'espacio' | 'papelera' | 'jerarquia' | 'contenido' | 'comparticiones';
    titulo: string;
    descripcion: string;
    reparable: boolean;
    problemas: number;
    ejemplos: Record<string, unknown>[];
  }[];
}
