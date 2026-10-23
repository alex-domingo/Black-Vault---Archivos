// Comparticiones y comentarios de la carga inicial (RD-04).
// Las fechas están en hora de Guatemala.
//
// recurso: ruta dentro de la unidad del propietario ("de").
//   - carpeta: 'Contratos/2026'
//   - archivo: 'Contratos/2026/Clientes/Contrato - Café Altiplano.md' (o solo el nombre si está en la raíz)
// cambios: modificaciones posteriores del permiso.  retirada: fecha en que el propietario quitó el acceso.
//
// La carga verifica que cada fecha sea posterior a la creación del recurso y de los usuarios,
// y que cada comentario tenga, en su fecha, al menos el permiso "comentario".

export const COMPARTICIONES = [
  // ------------------------------------------------------------ mlopez (Legal)
  // Herencia: Laura ve todos los contratos de 2026; José puede comentar solo los de clientes.
  { de: 'mlopez', tipo: 'carpeta', recurso: 'Contratos/2026', para: 'lhernandez', permiso: 'lectura', fecha: '2026-06-05T10:00' },
  { de: 'mlopez', tipo: 'carpeta', recurso: 'Contratos/2026/Clientes', para: 'jramirez', permiso: 'comentario', fecha: '2026-06-10T08:30' },
  { de: 'mlopez', tipo: 'archivo', recurso: 'Contratos/2026/Proveedores/Contrato - Soporte informático.md', para: 'dperez', permiso: 'edicion', fecha: '2026-08-05T09:00' },
  { de: 'mlopez', tipo: 'carpeta', recurso: 'Plantillas', para: 'agarcia', permiso: 'lectura', fecha: '2026-05-15T11:00', cambios: [{ fecha: '2026-07-01T09:00', permiso: 'comentario' }] },
  { de: 'mlopez', tipo: 'carpeta', recurso: 'Plantillas', para: 'lhernandez', permiso: 'lectura', fecha: '2026-06-06T09:15' },
  { de: 'mlopez', tipo: 'archivo', recurso: 'Actas/Reunión con auditoría externa.md', para: 'vrodriguez', permiso: 'comentario', fecha: '2026-09-09T08:00' },
  { de: 'mlopez', tipo: 'archivo', recurso: 'Actas/Reunión con auditoría externa.md', para: 'fsoto', permiso: 'lectura', fecha: '2026-09-09T08:05' },
  { de: 'mlopez', tipo: 'archivo', recurso: 'Pendientes legales.txt', para: 'rcastillo', permiso: 'lectura', fecha: '2026-10-06T08:00', retirada: '2026-10-10T16:30' },

  // ------------------------------------------------------------ jramirez (Finanzas)
  { de: 'jramirez', tipo: 'carpeta', recurso: 'Informes financieros', para: 'rcastillo', permiso: 'edicion', fecha: '2026-05-20T09:00' },
  { de: 'jramirez', tipo: 'carpeta', recurso: 'Informes financieros', para: 'mlopez', permiso: 'lectura', fecha: '2026-07-20T10:00' },
  { de: 'jramirez', tipo: 'archivo', recurso: 'Presupuestos/2026/Presupuesto de tecnología.txt', para: 'dperez', permiso: 'comentario', fecha: '2026-06-01T08:30' },
  { de: 'jramirez', tipo: 'carpeta', recurso: 'Facturación', para: 'lhernandez', permiso: 'comentario', fecha: '2026-06-25T14:00', cambios: [{ fecha: '2026-08-12T08:00', permiso: 'edicion' }] },
  { de: 'jramirez', tipo: 'archivo', recurso: 'Memorándum - cierre de mes.txt', para: 'rcastillo', permiso: 'lectura', fecha: '2026-09-29T09:00' },
  { de: 'jramirez', tipo: 'archivo', recurso: 'Memorándum - cierre de mes.txt', para: 'agarcia', permiso: 'lectura', fecha: '2026-09-29T09:01' },

  // ------------------------------------------------------------ agarcia (Recursos Humanos)
  { de: 'agarcia', tipo: 'carpeta', recurso: 'Políticas', para: 'cmorales', permiso: 'lectura', fecha: '2026-05-27T08:00' },
  { de: 'agarcia', tipo: 'carpeta', recurso: 'Políticas', para: 'smendez', permiso: 'lectura', fecha: '2026-05-27T08:01' },
  { de: 'agarcia', tipo: 'carpeta', recurso: 'Políticas', para: 'dperez', permiso: 'lectura', fecha: '2026-05-27T08:02' },
  { de: 'agarcia', tipo: 'archivo', recurso: 'Personal/Evaluaciones/Formato de evaluación.txt', para: 'smendez', permiso: 'edicion', fecha: '2026-06-21T10:00' },
  { de: 'agarcia', tipo: 'archivo', recurso: 'Calendario de capacitaciones.txt', para: 'mlopez', permiso: 'comentario', fecha: '2026-09-03T09:00' },

  // ------------------------------------------------------------ cmorales (Operaciones)
  { de: 'cmorales', tipo: 'carpeta', recurso: 'Procedimientos', para: 'vrodriguez', permiso: 'comentario', fecha: '2026-06-06T08:00' },
  { de: 'cmorales', tipo: 'carpeta', recurso: 'Reportes semanales', para: 'jramirez', permiso: 'lectura', fecha: '2026-06-09T08:00' },

  // ------------------------------------------------------------ smendez (Proyectos)
  // Diego tiene edición en Atlas y sube un archivo dentro (queda a nombre de Sofía, ver estructura.js).
  { de: 'smendez', tipo: 'carpeta', recurso: 'Proyectos/Proyecto Atlas', para: 'dperez', permiso: 'edicion', fecha: '2026-07-01T08:00' },
  { de: 'smendez', tipo: 'carpeta', recurso: 'Proyectos/Proyecto Atlas', para: 'lhernandez', permiso: 'lectura', fecha: '2026-08-01T09:00' },
  { de: 'smendez', tipo: 'archivo', recurso: 'Proyectos/Proyecto Atlas/Entregables/Informe de avance Atlas - septiembre.md', para: 'mlopez', permiso: 'comentario', fecha: '2026-10-01T08:00' },
  { de: 'smendez', tipo: 'carpeta', recurso: 'Proyectos/Proyecto Quetzal', para: 'fsoto', permiso: 'lectura', fecha: '2026-08-26T09:00', retirada: '2026-09-15T10:00' },

  // ------------------------------------------------------------ rcastillo, lhernandez, vrodriguez
  { de: 'rcastillo', tipo: 'carpeta', recurso: 'Cierres contables', para: 'jramirez', permiso: 'edicion', fecha: '2026-07-07T09:00' },
  { de: 'lhernandez', tipo: 'archivo', recurso: 'Propuestas/Propuesta comercial - Constructora Pacífico.md', para: 'mlopez', permiso: 'comentario', fecha: '2026-07-25T10:00' },
  { de: 'lhernandez', tipo: 'carpeta', recurso: 'Clientes', para: 'smendez', permiso: 'lectura', fecha: '2026-08-20T11:00' },
  { de: 'vrodriguez', tipo: 'archivo', recurso: 'Auditorías internas/Plan de auditoría interna 2026.md', para: 'fsoto', permiso: 'edicion', fecha: '2026-06-25T08:30' },

  // ------------------------------------------------------------ dperez (TI): el manual, con la mayor cantidad de usuarios
  ...['mlopez', 'jramirez', 'agarcia', 'cmorales', 'smendez', 'vrodriguez'].map((para, i) => ({
    de: 'dperez',
    tipo: 'archivo',
    recurso: 'Manuales/Manual de uso de Black Vault.md',
    para,
    permiso: 'lectura',
    fecha: `2026-06-15T09:0${i}`,
  })),

  // ------------------------------------------------------------ pjuarez (inactiva desde el 30 de septiembre)
  // Lo que compartió antes de irse sigue disponible (RN-09).
  { de: 'pjuarez', tipo: 'archivo', recurso: 'Entregas finales/Informe de entrega de puesto.md', para: 'agarcia', permiso: 'lectura', fecha: '2026-09-28T16:00' },
];

export const COMENTARIOS = [
  { de: 'mlopez', archivo: 'Contratos/2026/Clientes/Contrato - Agrícola del Sur.md', autor: 'jramirez', fecha: '2026-06-12T09:10', texto: 'Falta el NIT del cliente en la primera página.' },
  { de: 'mlopez', archivo: 'Contratos/2026/Clientes/Contrato - Agrícola del Sur.md', autor: 'mlopez', fecha: '2026-06-12T11:30', texto: 'Agregado. Gracias por revisarlo.' },
  { de: 'mlopez', archivo: 'Contratos/2026/Clientes/Contrato - Café Altiplano.md', autor: 'jramirez', fecha: '2026-06-11T10:00', texto: 'Confirmar con Finanzas el monto del anticipo antes de la firma.' },
  { de: 'mlopez', archivo: 'Contratos/2026/Clientes/Contrato - Café Altiplano.md', autor: 'mlopez', fecha: '2026-06-11T15:20', texto: 'Confirmado: 30 % de anticipo, ya está en la cláusula 5.' },
  { de: 'mlopez', archivo: 'Contratos/2026/Proveedores/Contrato - Soporte informático.md', autor: 'dperez', fecha: '2026-08-06T09:40', texto: 'Revisé el anexo de niveles de servicio: los tiempos de respuesta son razonables.' },
  { de: 'mlopez', archivo: 'Plantillas/Cláusulas de confidencialidad.txt', autor: 'agarcia', fecha: '2026-07-02T14:00', texto: '¿Podemos usar estas cláusulas en los contratos de personal temporal?' },
  { de: 'mlopez', archivo: 'Plantillas/Cláusulas de confidencialidad.txt', autor: 'mlopez', fecha: '2026-07-03T08:45', texto: 'Sí, solo cambia la duración a 12 meses.' },
  { de: 'mlopez', archivo: 'Actas/Reunión con auditoría externa.md', autor: 'vrodriguez', fecha: '2026-09-10T10:15', texto: 'Agregar el compromiso de entregar las conciliaciones antes del 30 de septiembre.' },
  { de: 'jramirez', archivo: 'Presupuestos/2026/Presupuesto de tecnología.txt', autor: 'dperez', fecha: '2026-06-02T08:20', texto: 'Falta la renovación de las licencias de antivirus (Q 12,000).' },
  { de: 'jramirez', archivo: 'Presupuestos/2026/Presupuesto de tecnología.txt', autor: 'jramirez', fecha: '2026-06-03T09:00', texto: 'Incluida en la partida de licencias.' },
  { de: 'jramirez', archivo: 'Facturación/Clientes con saldo pendiente.txt', autor: 'lhernandez', fecha: '2026-08-12T10:30', texto: 'Agrícola del Sur ya pagó la factura 1043.' },
  { de: 'jramirez', archivo: 'Facturación/Política de cobros.md', autor: 'lhernandez', fecha: '2026-07-02T16:00', texto: 'Sugiero recordar el cobro por correo cinco días antes del vencimiento.' },
  { de: 'agarcia', archivo: 'Calendario de capacitaciones.txt', autor: 'mlopez', fecha: '2026-09-04T11:00', texto: '¿Podemos agregar una charla sobre protección de datos personales en noviembre?' },
  { de: 'agarcia', archivo: 'Calendario de capacitaciones.txt', autor: 'agarcia', fecha: '2026-09-05T08:30', texto: 'Sí, quedó programada para el 12 de noviembre.' },
  { de: 'cmorales', archivo: 'Procedimientos/Procedimiento de compras.md', autor: 'vrodriguez', fecha: '2026-06-08T09:30', texto: 'El paso 3 debería exigir tres cotizaciones para compras mayores a Q 5,000.' },
  { de: 'smendez', archivo: 'Proyectos/Proyecto Atlas/Entregables/Informe de avance Atlas - septiembre.md', autor: 'mlopez', fecha: '2026-10-02T09:00', texto: 'Revisar la cláusula de penalización por retraso antes de enviarlo al cliente.' },
  { de: 'smendez', archivo: 'Proyectos/Proyecto Atlas/Entregables/Informe de avance Atlas - septiembre.md', autor: 'dperez', fecha: '2026-10-02T10:30', texto: 'Los servidores de pruebas quedaron listos; detalle en el checklist.' },
  { de: 'lhernandez', archivo: 'Propuestas/Propuesta comercial - Constructora Pacífico.md', autor: 'mlopez', fecha: '2026-07-26T09:00', texto: 'Agregar la cláusula de confidencialidad estándar.' },
  { de: 'vrodriguez', archivo: 'Auditorías internas/Plan de auditoría interna 2026.md', autor: 'fsoto', fecha: '2026-06-26T15:00', texto: 'Propongo mover la auditoría de compras a agosto.' },
  { de: 'dperez', archivo: 'Manuales/Manual de uso de Black Vault.md', autor: 'dperez', fecha: '2026-06-15T09:30', texto: 'Versión 1.0 publicada. Escríbanme si algo no queda claro.' },
];
