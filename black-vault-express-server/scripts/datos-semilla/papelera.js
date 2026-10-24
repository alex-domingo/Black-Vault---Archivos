// Papelera de la carga inicial (RD-05). Fechas en hora de Guatemala.
// Rutas dentro de la unidad del usuario, igual que en comparticiones.js.

/** Lo que queda en la papelera: 6 archivos en total. */
export const EN_PAPELERA = [
  // Se eliminó por separado antes que su carpeta: dentro de la cascada conserva su propia raíz.
  { usuario: 'cmorales', tipo: 'archivo', ruta: 'Procedimientos/Almacén/Inventario de papelería.txt', fecha: '2026-09-01T10:00' },
  // Archivo eliminado por separado dentro de una carpeta que sigue activa (y compartida con José).
  { usuario: 'cmorales', tipo: 'archivo', ruta: 'Reportes semanales/Reporte semanal 23.txt', fecha: '2026-10-06T09:00' },
  // Carpeta con subcarpeta y archivos (cascada). Estaba compartida con Valeria: deja de verla.
  { usuario: 'cmorales', tipo: 'carpeta', ruta: 'Procedimientos', fecha: '2026-10-08T16:00' },
  // Archivos sueltos de la raíz.
  { usuario: 'lhernandez', tipo: 'archivo', ruta: 'Contactos de prospectos.txt', fecha: '2026-10-15T11:00' },
  { usuario: 'smendez', tipo: 'archivo', ruta: 'Lecciones aprendidas.md', fecha: '2026-10-16T17:30' },
];

/** Se enviaron a la papelera y se restauraron: solo quedan en el historial. */
export const RESTAURADOS = [
  { usuario: 'smendez', tipo: 'archivo', ruta: 'Proyectos/Proyecto Atlas/Cronograma Atlas.txt', enviado: '2026-08-10T09:00', restaurado: '2026-08-10T09:20' },
];

/**
 * Archivos que existieron y se eliminaron definitivamente. Ya no están en la base,
 * pero su historial se conserva (RN-07) y aparece en la actividad y en los reportes.
 */
export const ELIMINADOS = [
  { usuario: 'jramirez', ruta: 'Presupuestos/2026', nombre: 'Presupuesto 2025 (copia).txt', bytes: 964, subido: '2026-05-14T09:30', enviado: '2026-05-30T15:00', eliminado: '2026-05-30T15:05' },
  { usuario: 'lhernandez', ruta: 'Propuestas', nombre: 'Borrador de propuesta - Hotel Vista Lago.md', bytes: 1840, subido: '2026-06-02T10:00', enviado: '2026-06-20T09:00', eliminado: '2026-07-05T08:00' },
];
