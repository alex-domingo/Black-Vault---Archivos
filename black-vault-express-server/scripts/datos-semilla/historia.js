// Historial complementario de la carga inicial (RD-06): lo que pasó con los documentos
// además de crearlos, compartirlos y comentarlos. Fechas en hora de Guatemala.
//
// Cada entrada se aplica a los documentos (versión, nombre, ubicación, cuota…) para que el
// estado final y el historial cuenten la misma historia. La carga verifica permisos y fechas.
// Las rutas de archivos y carpetas son las ACTUALES (después de renombrar o mover).

/** Ediciones de contenido. "por" puede ser el dueño o alguien con permiso de edición en esa fecha. */
export const EDICIONES = [
  { de: 'mlopez', archivo: 'Contratos/2026/Clientes/Contrato - Café Altiplano.md', por: 'mlopez', fecha: '2026-06-11T15:10' },
  { de: 'mlopez', archivo: 'Contratos/2026/Clientes/Contrato - Agrícola del Sur.md', por: 'mlopez', fecha: '2026-06-12T11:25' },
  { de: 'mlopez', archivo: 'Plantillas/Cláusulas de confidencialidad.txt', por: 'mlopez', fecha: '2026-07-03T09:00' },
  { de: 'mlopez', archivo: 'Contratos/2026/Proveedores/Contrato - Soporte informático.md', por: 'dperez', fecha: '2026-08-06T09:30' },
  { de: 'mlopez', archivo: 'Actas/Reunión con auditoría externa.md', por: 'mlopez', fecha: '2026-09-10T16:00' },
  { de: 'jramirez', archivo: 'Presupuestos/2026/Presupuesto de tecnología.txt', por: 'jramirez', fecha: '2026-06-03T08:50' },
  { de: 'jramirez', archivo: 'Informes financieros/Trimestre 2/Flujo de caja junio.md', por: 'rcastillo', fecha: '2026-07-06T10:00' },
  { de: 'jramirez', archivo: 'Facturación/Clientes con saldo pendiente.txt', por: 'lhernandez', fecha: '2026-08-12T10:40' },
  { de: 'rcastillo', archivo: 'Cierres contables/2026/Cierre contable - junio.md', por: 'jramirez', fecha: '2026-07-08T09:30' },
  { de: 'vrodriguez', archivo: 'Auditorías internas/Plan de auditoría interna 2026.md', por: 'fsoto', fecha: '2026-06-26T15:30' },
  { de: 'agarcia', archivo: 'Personal/Evaluaciones/Formato de evaluación.txt', por: 'smendez', fecha: '2026-06-22T09:00' },
  { de: 'agarcia', archivo: 'Calendario de capacitaciones.txt', por: 'agarcia', fecha: '2026-09-05T08:40' },
  { de: 'smendez', archivo: 'Proyectos/Proyecto Atlas/Cronograma Atlas.txt', por: 'dperez', fecha: '2026-07-15T11:00' },
  { de: 'smendez', archivo: 'Proyectos/Proyecto Atlas/Cronograma Atlas.txt', por: 'smendez', fecha: '2026-09-01T10:00' },
  { de: 'smendez', archivo: 'Proyectos/Proyecto Atlas/Entregables/Informe de avance Atlas - septiembre.md', por: 'smendez', fecha: '2026-10-02T15:00' },
  { de: 'cmorales', archivo: 'Reportes semanales/Reporte semanal 31.txt', por: 'cmorales', fecha: '2026-08-04T09:00' },
  { de: 'dperez', archivo: 'Manuales/Manual de uso de Black Vault.md', por: 'dperez', fecha: '2026-07-20T14:00' },
  { de: 'dperez', archivo: 'Manuales/Manual de uso de Black Vault.md', por: 'dperez', fecha: '2026-09-15T14:00' },
  { de: 'lhernandez', archivo: 'Propuestas/Propuesta comercial - Constructora Pacífico.md', por: 'lhernandez', fecha: '2026-07-27T10:00' },
];

/** Cambios de nombre: antes de esta fecha, el historial muestra el nombre anterior. */
export const RENOMBRES = [
  { de: 'mlopez', tipo: 'archivo', ruta: 'Plantillas/Plantilla de contrato de servicios.md', nombreAnterior: 'Plantilla contrato.md', fecha: '2026-05-10T09:00' },
  { de: 'jramirez', tipo: 'archivo', ruta: 'Memorándum - cierre de mes.txt', nombreAnterior: 'Memo cierre septiembre.txt', fecha: '2026-09-29T08:20' },
  { de: 'agarcia', tipo: 'archivo', ruta: 'Políticas/Política de vacaciones.md', nombreAnterior: 'Vacaciones 2026.md', fecha: '2026-08-18T09:40' },
  { de: 'lhernandez', tipo: 'carpeta', ruta: 'Propuestas', nombreAnterior: 'Propuestas comerciales', fecha: '2026-07-01T08:00' },
  { de: 'cmorales', tipo: 'carpeta', ruta: 'Reportes semanales', nombreAnterior: 'Reportes', fecha: '2026-06-09T07:30' },
];

/** Movimientos. desde: carpeta anterior ('' = raíz). Antes de la fecha, el historial ubica el elemento allí. */
export const MOVIMIENTOS = [
  { de: 'lhernandez', tipo: 'archivo', ruta: 'Propuestas/Tarifario 2026.txt', desde: '', fecha: '2026-05-22T09:30' },
  { de: 'rcastillo', tipo: 'archivo', ruta: 'Conciliaciones/Conciliación bancaria agosto.txt', desde: '', fecha: '2026-09-04T11:00' },
  { de: 'vrodriguez', tipo: 'archivo', ruta: 'Normas/Control de documentos.md', desde: 'Auditorías internas', fecha: '2026-08-13T09:00' },
  { de: 'smendez', tipo: 'carpeta', ruta: 'Reuniones', desde: 'Proyectos', fecha: '2026-09-20T10:00' },
];

/** Cambios de clasificación. "despues" debe coincidir con el valor actual del archivo. */
export const CLASIFICACIONES = [
  { de: 'mlopez', archivo: 'Contratos/2026/Clientes/Contrato - Agrícola del Sur.md', fecha: '2026-06-12T11:35', cambios: { etiquetas: { antes: ['cliente'], despues: ['cliente', 'vigente', '2026'] } } },
  { de: 'jramirez', archivo: 'Facturación/Política de cobros.md', fecha: '2026-06-23T08:00', cambios: { etiquetas: { antes: ['cobros'], despues: ['política', 'cobros'] } } },
  { de: 'cmorales', archivo: 'Plan de mantenimiento de oficinas.md', fecha: '2026-07-15T09:00', cambios: { categoria: { antes: 'otro', despues: 'informe' } } },
  { de: 'smendez', archivo: 'Proyectos/Proyecto Quetzal/Propuesta técnica Quetzal.md', fecha: '2026-08-26T08:00', cambios: { categoria: { antes: 'informe', despues: 'contrato' } } },
  { de: 'dperez', archivo: 'Manuales/Manual de uso de Black Vault.md', fecha: '2026-06-12T10:30', cambios: { etiquetas: { antes: ['manual'], despues: ['manual', 'black vault'] } } },
];

/** Comentarios que se escribieron y luego se borraron: solo quedan en el historial. */
export const COMENTARIOS_BORRADOS = [
  { de: 'mlopez', archivo: 'Contratos/2026/Clientes/Contrato - Textiles Maya.md', autor: 'jramirez', texto: 'Duplicado, ignorar.', escrito: '2026-07-22T10:00', borrado: '2026-07-22T10:05', borradoPor: 'jramirez' },
  { de: 'jramirez', archivo: 'Facturación/Política de cobros.md', autor: 'lhernandez', texto: 'Prueba de comentario.', escrito: '2026-07-05T09:00', borrado: '2026-07-05T12:00', borradoPor: 'jramirez' },
];

/** Intentos fallidos de inicio de sesión (el de pjuarez, con la cuenta ya desactivada). */
export const SESIONES_FALLIDAS = [
  { usuario: 'mlopez', fecha: '2026-06-01T08:55', motivo: 'Contraseña incorrecta' },
  { usuario: 'jramirez', fecha: '2026-07-14T08:01', motivo: 'Contraseña incorrecta' },
  { usuario: 'jramirez', fecha: '2026-07-14T08:02', motivo: 'Contraseña incorrecta' },
  { usuario: 'pjuarez', fecha: '2026-10-02T08:30', motivo: 'Usuario inactivo' },
];

/** Cambios de contraseña hechos por cada usuario. */
export const CLAVES_CAMBIADAS = [
  { usuario: 'mlopez', fecha: '2026-06-01T09:05' },
  { usuario: 'agarcia', fecha: '2026-08-03T08:45' },
];

/** Acciones del administrador sobre las cuentas. */
export const ADMINISTRACION = [
  { accion: 'USUARIO_ACTUALIZADO', usuario: 'mlopez', fecha: '2026-07-10T09:00', cuotaMb: { antes: 100, despues: 200 } },
  { accion: 'USUARIO_CLAVE_RESTABLECIDA', usuario: 'cmorales', fecha: '2026-08-20T08:15' },
  // Desactivado por error y reactivado minutos después: el historial lo conserva.
  { accion: 'USUARIO_DESACTIVADO', usuario: 'fsoto', fecha: '2026-07-01T10:00' },
  { accion: 'USUARIO_ACTIVADO', usuario: 'fsoto', fecha: '2026-07-01T10:12' },
];

/**
 * Lecturas y descargas generadas (con una semilla fija, así que siempre salen iguales).
 * Solo se generan en días hábiles, en horario de oficina y cuando la persona tenía acceso.
 */
export const USO = {
  semilla: 2026,
  ultimoDia: '2026-10-23',
  /** Veces que el dueño abre cada archivo (al azar entre min y max). */
  consultasDueno: { min: 0, max: 2 },
  /** Probabilidad de que alguien con acceso compartido abra un archivo. */
  probabilidadConsultaCompartida: 0.55,
  /** Probabilidad de que una consulta vaya seguida de una descarga. */
  probabilidadDescarga: 0.3,
  /** Probabilidad de cerrar sesión al final de un día con actividad. */
  probabilidadCierre: 0.45,
};
