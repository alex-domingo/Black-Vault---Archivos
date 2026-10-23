// Carpetas y archivos de la carga inicial (RD-02 y RD-03).
// 57 archivos de 11 usuarios, .md y .txt, las cuatro categorías y varios niveles de carpetas.
// La cantidad por usuario es desigual a propósito, para que el "Top 10" tenga sentido.
//
// ruta: carpeta donde va el archivo ('' = raíz). Las carpetas se crean a partir de las rutas.
// fecha: hora de Guatemala.

const firmante = 'María Fernanda López, Gerente Legal';

export const CARPETAS_VACIAS = [
  { usuario: 'mlopez', ruta: 'Contratos/2025', fecha: '2026-05-09T09:00' },
  { usuario: 'dperez', ruta: 'Infraestructura/Respaldos', fecha: '2026-06-02T08:00' },
];

export const ARCHIVOS = [
  // ------------------------------------------------------------ mlopez (Legal) · 11
  { usuario: 'mlopez', ruta: 'Contratos/2026/Clientes', nombre: 'Contrato - Agrícola del Sur.md', categoria: 'contrato', etiquetas: ['cliente', 'vigente', '2026'], fecha: '2026-05-12T10:15',
    descripcion: 'Contrato anual de asesoría contable.', plantilla: 'contrato', datos: { cliente: 'Agrícola del Sur, S.A.', servicio: 'asesoría contable y fiscal', monto: 18500, meses: 12, fecha: '2026-05-12', firmante } },
  { usuario: 'mlopez', ruta: 'Contratos/2026/Clientes', nombre: 'Contrato - Café Altiplano.md', categoria: 'contrato', etiquetas: ['cliente', 'vigente'], fecha: '2026-06-03T11:40',
    plantilla: 'contrato', datos: { cliente: 'Café Altiplano, S.A.', servicio: 'consultoría en procesos de exportación', monto: 22000, meses: 6, fecha: '2026-06-03', firmante } },
  { usuario: 'mlopez', ruta: 'Contratos/2026/Clientes', nombre: 'Contrato - Textiles Maya.md', categoria: 'contrato', etiquetas: ['cliente', 'renovación'], fecha: '2026-07-21T09:05',
    plantilla: 'contrato', datos: { cliente: 'Textiles Maya, Ltda.', servicio: 'auditoría de cumplimiento laboral', monto: 15750, meses: 4, fecha: '2026-07-21', firmante } },
  { usuario: 'mlopez', ruta: 'Contratos/2026/Proveedores', nombre: 'Contrato - Servicios de limpieza.md', categoria: 'contrato', etiquetas: ['proveedor'], fecha: '2026-05-20T15:30',
    plantilla: 'contrato', datos: { cliente: 'Limpieza Integral GT', servicio: 'limpieza de oficinas', monto: 4200, meses: 12, fecha: '2026-05-20', firmante } },
  { usuario: 'mlopez', ruta: 'Contratos/2026/Proveedores', nombre: 'Contrato - Soporte informático.md', categoria: 'contrato', etiquetas: ['proveedor', 'ti'], fecha: '2026-08-04T10:00',
    plantilla: 'contrato', datos: { cliente: 'RedNet Soluciones', servicio: 'soporte técnico y mantenimiento de equipos', monto: 6800, meses: 12, fecha: '2026-08-04', firmante } },
  { usuario: 'mlopez', ruta: 'Plantillas', nombre: 'Plantilla de contrato de servicios.md', categoria: 'administrativo', etiquetas: ['plantilla'], fecha: '2026-05-10T08:30',
    descripcion: 'Base para nuevos contratos con clientes.', plantilla: 'contrato', datos: { cliente: '[NOMBRE DEL CLIENTE]', servicio: '[DESCRIPCIÓN DEL SERVICIO]', monto: 0, meses: 12, fecha: '2026-05-10', firmante } },
  { usuario: 'mlopez', ruta: 'Plantillas', nombre: 'Cláusulas de confidencialidad.txt', categoria: 'administrativo', etiquetas: ['plantilla', 'confidencialidad'], fecha: '2026-05-11T16:20',
    plantilla: 'notas', datos: { titulo: 'CLÁUSULAS TIPO DE CONFIDENCIALIDAD', lineas: ['1. La información se usará solo para el fin acordado.', '2. No se divulgará a terceros sin autorización escrita.', '3. La obligación subsiste dos años después del contrato.', '4. Se devolverá o destruirá la información al terminar.'] } },
  { usuario: 'mlopez', ruta: 'Actas', nombre: 'Reunión de planificación legal - junio.md', categoria: 'informe', etiquetas: ['reunión', 'planificación'], fecha: '2026-06-15T17:00',
    plantilla: 'acta', datos: { titulo: 'Planificación legal del segundo semestre', fecha: '2026-06-15', asistentes: ['María Fernanda López', 'José Antonio Ramírez', 'Fernando Soto Cifuentes'], temas: ['Renovaciones de contratos', 'Litigios en curso', 'Capacitación en cumplimiento'], acuerdos: ['Preparar calendario de renovaciones', 'Enviar resumen de litigios a gerencia'] } },
  { usuario: 'mlopez', ruta: 'Actas', nombre: 'Reunión con auditoría externa.md', categoria: 'informe', etiquetas: ['reunión', 'auditoría'], fecha: '2026-09-08T11:30',
    plantilla: 'acta', datos: { titulo: 'Coordinación con auditoría externa', fecha: '2026-09-08', asistentes: ['María Fernanda López', 'Fernando Soto Cifuentes', 'Ricardo Castillo Ordóñez'], temas: ['Alcance de la auditoría', 'Documentación requerida'], acuerdos: ['Compartir contratos vigentes', 'Designar enlace con el auditor'] } },
  { usuario: 'mlopez', ruta: '', nombre: 'Pendientes legales.txt', categoria: 'otro', etiquetas: ['pendientes'], fecha: '2026-10-05T08:45',
    plantilla: 'lista', datos: { titulo: 'Pendientes legales de octubre', elementos: ['Revisar renovación de Agrícola del Sur', 'Firmar adenda con RedNet', 'Responder consulta de Recursos Humanos', 'Actualizar plantilla de contrato'] } },
  { usuario: 'mlopez', ruta: '', nombre: 'Notas de Windows.txt', categoria: 'otro', etiquetas: ['notas'], fecha: '2026-10-12T19:10',
    descripcion: 'Escrito en el Bloc de notas: conserva BOM y saltos CRLF.', formato: 'windows', plantilla: 'notas', datos: { titulo: 'Notas rápidas', lineas: ['- Llamar al notario el martes.', '- Revisar poderes de representación.', '- Año fiscal: confirmar fechas de cierre.'] } },

  // ------------------------------------------------------------ jramirez (Finanzas) · 9
  { usuario: 'jramirez', ruta: 'Presupuestos/2026', nombre: 'Año fiscal 2026 - presupuesto general.txt', categoria: 'administrativo', etiquetas: ['presupuesto', '2026'], fecha: '2026-05-14T09:00',
    plantilla: 'presupuesto', datos: { titulo: 'PRESUPUESTO GENERAL 2026', partidas: [['Salarios', 1850000], ['Alquiler de oficinas', 240000], ['Servicios públicos', 48000], ['Tecnología', 125000], ['Capacitación', 60000], ['Imprevistos', 45000]] } },
  { usuario: 'jramirez', ruta: 'Presupuestos/2026', nombre: 'Presupuesto de tecnología.txt', categoria: 'administrativo', etiquetas: ['presupuesto', 'ti'], fecha: '2026-05-28T14:10',
    plantilla: 'presupuesto', datos: { titulo: 'PRESUPUESTO DE TECNOLOGÍA', partidas: [['Licencias', 42000], ['Equipos portátiles', 56000], ['Servidor de respaldo', 18000], ['Soporte', 9000]] } },
  { usuario: 'jramirez', ruta: 'Informes financieros/Trimestre 1', nombre: 'Estado de resultados T1.md', categoria: 'informe', etiquetas: ['finanzas', 'trimestral'], fecha: '2026-05-18T10:30',
    plantilla: 'informe', datos: { titulo: 'Estado de resultados - primer trimestre', periodo: 'enero a marzo de 2026', indicadores: [['Ingresos (Q)', '1,200,000', '1,264,300'], ['Margen operativo', '18 %', '19.4 %'], ['Cuentas por cobrar (días)', '45', '52']], conclusion: 'Los ingresos superaron la meta, pero los días de cobro aumentaron.' } },
  { usuario: 'jramirez', ruta: 'Informes financieros/Trimestre 2', nombre: 'Estado de resultados T2.md', categoria: 'informe', etiquetas: ['finanzas', 'trimestral'], fecha: '2026-07-16T11:15',
    plantilla: 'informe', datos: { titulo: 'Estado de resultados - segundo trimestre', periodo: 'abril a junio de 2026', indicadores: [['Ingresos (Q)', '1,250,000', '1,198,750'], ['Margen operativo', '18 %', '16.9 %'], ['Cuentas por cobrar (días)', '45', '47']], conclusion: 'Ingresos por debajo de la meta por el retraso de dos proyectos.' } },
  { usuario: 'jramirez', ruta: 'Informes financieros/Trimestre 2', nombre: 'Flujo de caja junio.md', categoria: 'informe', etiquetas: ['finanzas', 'flujo de caja'], fecha: '2026-07-03T16:40',
    plantilla: 'informe', datos: { titulo: 'Flujo de caja', periodo: 'junio de 2026', indicadores: [['Saldo inicial (Q)', '—', '485,200'], ['Entradas (Q)', '410,000', '402,960'], ['Salidas (Q)', '380,000', '371,400']], conclusion: 'El saldo final se mantuvo positivo.' } },
  { usuario: 'jramirez', ruta: 'Facturación', nombre: 'Clientes con saldo pendiente.txt', categoria: 'informe', etiquetas: ['cobros'], fecha: '2026-08-11T09:20',
    plantilla: 'lista', datos: { titulo: 'Clientes con saldo pendiente', elementos: ['Café Altiplano - 2 facturas', 'Textiles Maya - 1 factura', 'Constructora Pacífico - 3 facturas'] } },
  { usuario: 'jramirez', ruta: 'Facturación', nombre: 'Política de cobros.md', categoria: 'administrativo', etiquetas: ['política', 'cobros'], fecha: '2026-06-22T10:00',
    plantilla: 'politica', datos: { titulo: 'Política de cobros', area: 'Finanzas', version: '1.2', puntos: ['Toda factura vence a los 30 días.', 'A los 45 días se envía recordatorio formal.', 'A los 60 días se suspende el servicio previo aviso.'] } },
  { usuario: 'jramirez', ruta: '', nombre: 'Memorándum - cierre de mes.txt', categoria: 'administrativo', etiquetas: ['memorándum'], fecha: '2026-09-29T08:00',
    plantilla: 'memo', datos: { para: 'Todas las áreas', de: 'José Antonio Ramírez', asunto: 'Cierre contable de septiembre', fecha: '29 de septiembre de 2026', cuerpo: 'Se solicita enviar las liquidaciones de gastos a más tardar el 2 de octubre.' } },
  { usuario: 'jramirez', ruta: '', nombre: 'Registro antiguo de caja chica.txt', categoria: 'otro', etiquetas: ['caja chica'], fecha: '2026-05-15T12:00',
    descripcion: 'Exportado de un sistema viejo en latin1: se puede ver, pero no editar en línea.', formato: 'latin1', plantilla: 'notas', datos: { titulo: 'Caja chica - registro histórico', lineas: ['01/04 Papelería ......... Q 125.00', '05/04 Café y azúcar ...... Q  64.50', '12/04 Mensajería ......... Q  90.00', 'Año 2026 - revisión pendiente'] } },

  // ------------------------------------------------------------ agarcia (Recursos Humanos) · 8
  { usuario: 'agarcia', ruta: 'Personal/Contrataciones', nombre: 'Perfil de puesto - analista contable.md', categoria: 'administrativo', etiquetas: ['contratación', 'perfil'], fecha: '2026-05-19T09:30',
    plantilla: 'politica', datos: { titulo: 'Perfil de puesto: Analista contable', area: 'Recursos Humanos', version: '1.0', puntos: ['Licenciatura en Contaduría Pública o cierre de pénsum.', 'Dos años de experiencia en contabilidad general.', 'Manejo de hojas de cálculo avanzado.'] } },
  { usuario: 'agarcia', ruta: 'Personal/Contrataciones', nombre: 'Lista de verificación de ingreso.txt', categoria: 'administrativo', etiquetas: ['contratación', 'inducción'], fecha: '2026-06-01T08:15',
    plantilla: 'lista', datos: { titulo: 'Ingreso de nuevo colaborador', elementos: ['Firma de contrato', 'Alta en el IGSS', 'Entrega de equipo', 'Inducción general', 'Creación de usuario en Black Vault'] } },
  { usuario: 'agarcia', ruta: 'Personal/Evaluaciones', nombre: 'Evaluación de desempeño - primer semestre.md', categoria: 'informe', etiquetas: ['evaluación', 'semestral'], fecha: '2026-07-08T15:00',
    plantilla: 'informe', datos: { titulo: 'Evaluación de desempeño', periodo: 'el primer semestre de 2026', indicadores: [['Evaluaciones completadas', '100 %', '94 %'], ['Promedio general', '80', '84'], ['Planes de mejora', '—', '6']], conclusion: 'El desempeño promedio mejoró respecto al año anterior.' } },
  { usuario: 'agarcia', ruta: 'Personal/Evaluaciones', nombre: 'Formato de evaluación.txt', categoria: 'administrativo', etiquetas: ['evaluación', 'plantilla'], fecha: '2026-06-20T10:45',
    plantilla: 'lista', datos: { titulo: 'Formato de evaluación de desempeño', elementos: ['Cumplimiento de objetivos (40 %)', 'Calidad del trabajo (25 %)', 'Trabajo en equipo (20 %)', 'Puntualidad (15 %)'] } },
  { usuario: 'agarcia', ruta: 'Políticas', nombre: 'Política de teletrabajo.md', categoria: 'administrativo', etiquetas: ['política', 'teletrabajo'], fecha: '2026-05-26T11:00',
    plantilla: 'politica', datos: { titulo: 'Política de teletrabajo', area: 'Recursos Humanos', version: '2.0', puntos: ['Se permite teletrabajo hasta dos días por semana.', 'El colaborador debe estar disponible en horario laboral.', 'Los documentos se guardan únicamente en Black Vault.'] } },
  { usuario: 'agarcia', ruta: 'Políticas', nombre: 'Política de vacaciones.md', categoria: 'administrativo', etiquetas: ['política', 'vacaciones'], fecha: '2026-08-18T09:10',
    plantilla: 'politica', datos: { titulo: 'Política de vacaciones', area: 'Recursos Humanos', version: '1.1', puntos: ['Las vacaciones se solicitan con 15 días de anticipación.', 'Se pueden fraccionar en dos períodos.', 'El jefe inmediato aprueba la solicitud.'] } },
  { usuario: 'agarcia', ruta: '', nombre: 'Calendario de capacitaciones.txt', categoria: 'otro', etiquetas: ['capacitación'], fecha: '2026-09-02T13:30',
    plantilla: 'lista', datos: { titulo: 'Capacitaciones del cuarto trimestre', elementos: ['Octubre: Seguridad de la información', 'Noviembre: Servicio al cliente', 'Diciembre: Cierre fiscal'] } },
  { usuario: 'agarcia', ruta: '', nombre: 'Memorándum - uniformes.txt', categoria: 'administrativo', etiquetas: ['memorándum'], fecha: '2026-10-07T08:30',
    plantilla: 'memo', datos: { para: 'Todo el personal', de: 'Ana Lucía García', asunto: 'Entrega de uniformes', fecha: '7 de octubre de 2026', cuerpo: 'Los uniformes se entregarán en Recursos Humanos del 12 al 16 de octubre.' } },

  // ------------------------------------------------------------ cmorales (Operaciones) · 7
  { usuario: 'cmorales', ruta: 'Procedimientos/Almacén', nombre: 'Procedimiento de recepción de materiales.md', categoria: 'administrativo', etiquetas: ['procedimiento', 'almacén'], fecha: '2026-05-21T10:20',
    plantilla: 'procedimiento', datos: { titulo: 'Recepción de materiales', codigo: 'OP-ALM-001', pasos: ['Verificar la orden de compra contra la factura.', 'Revisar el estado físico de los materiales.', 'Registrar la entrada en el inventario.', 'Archivar la documentación en Black Vault.'] } },
  { usuario: 'cmorales', ruta: 'Procedimientos/Almacén', nombre: 'Inventario de papelería.txt', categoria: 'informe', etiquetas: ['inventario'], fecha: '2026-06-30T17:30',
    plantilla: 'lista', datos: { titulo: 'Inventario de papelería', elementos: ['Resmas de papel: 42', 'Tóner: 6', 'Folders: 300', 'Lapiceros: 150'] } },
  { usuario: 'cmorales', ruta: 'Procedimientos', nombre: 'Procedimiento de compras.md', categoria: 'administrativo', etiquetas: ['procedimiento', 'compras'], fecha: '2026-06-05T09:40',
    plantilla: 'procedimiento', datos: { titulo: 'Compras menores', codigo: 'OP-COM-002', pasos: ['Solicitar tres cotizaciones.', 'Elegir la mejor oferta y justificarla.', 'Obtener la aprobación de Finanzas.'] } },
  { usuario: 'cmorales', ruta: 'Reportes semanales', nombre: 'Reporte semanal 23.txt', categoria: 'informe', etiquetas: ['semanal'], fecha: '2026-06-08T18:00',
    plantilla: 'notas', datos: { titulo: 'REPORTE SEMANAL - SEMANA 23', lineas: ['Solicitudes atendidas: 38', 'Pendientes: 4', 'Incidentes: ninguno'] } },
  { usuario: 'cmorales', ruta: 'Reportes semanales', nombre: 'Reporte semanal 31.txt', categoria: 'informe', etiquetas: ['semanal'], fecha: '2026-08-03T18:05',
    plantilla: 'notas', datos: { titulo: 'REPORTE SEMANAL - SEMANA 31', lineas: ['Solicitudes atendidas: 45', 'Pendientes: 7', 'Incidentes: falla eléctrica el miércoles'] } },
  { usuario: 'cmorales', ruta: 'Reportes semanales', nombre: 'Reporte semanal 40.txt', categoria: 'informe', etiquetas: ['semanal'], fecha: '2026-10-05T18:10',
    plantilla: 'notas', datos: { titulo: 'REPORTE SEMANAL - SEMANA 40', lineas: ['Solicitudes atendidas: 41', 'Pendientes: 2', 'Incidentes: ninguno'] } },
  { usuario: 'cmorales', ruta: '', nombre: 'Plan de mantenimiento de oficinas.md', categoria: 'informe', etiquetas: ['mantenimiento'], fecha: '2026-07-14T10:00',
    plantilla: 'informe', datos: { titulo: 'Plan de mantenimiento', periodo: 'el segundo semestre de 2026', indicadores: [['Revisiones eléctricas', '2', '1'], ['Fumigaciones', '2', '2']], conclusion: 'Falta programar una revisión eléctrica.' } },

  // ------------------------------------------------------------ smendez (Proyectos) · 6
  { usuario: 'smendez', ruta: 'Proyectos/Proyecto Atlas/Entregables', nombre: 'Informe de avance Atlas - julio.md', categoria: 'informe', etiquetas: ['atlas', 'avance'], fecha: '2026-07-31T16:00',
    plantilla: 'informe', datos: { titulo: 'Proyecto Atlas: avance', periodo: 'julio de 2026', indicadores: [['Avance físico', '60 %', '55 %'], ['Presupuesto ejecutado', '58 %', '51 %']], conclusion: 'El proyecto tiene un retraso leve, recuperable en agosto.' } },
  { usuario: 'smendez', ruta: 'Proyectos/Proyecto Atlas/Entregables', nombre: 'Informe de avance Atlas - septiembre.md', categoria: 'informe', etiquetas: ['atlas', 'avance'], fecha: '2026-09-30T16:30',
    plantilla: 'informe', datos: { titulo: 'Proyecto Atlas: avance', periodo: 'septiembre de 2026', indicadores: [['Avance físico', '85 %', '86 %'], ['Presupuesto ejecutado', '82 %', '80 %']], conclusion: 'Se recuperó el retraso. La entrega final se mantiene para noviembre.' } },
  // Lo subió Diego (edición en "Proyecto Atlas"): pertenece a Sofía y usa su espacio (diseño, I-12).
  { usuario: 'smendez', creadoPor: 'dperez', ruta: 'Proyectos/Proyecto Atlas/Entregables', nombre: 'Checklist de servidores de pruebas.txt', categoria: 'informe', etiquetas: ['atlas', 'infraestructura'], fecha: '2026-09-28T17:00',
    plantilla: 'lista', datos: { titulo: 'Checklist de servidores de pruebas - Proyecto Atlas', elementos: ['Servidor de aplicaciones instalado', 'Base de datos de pruebas restaurada', 'Respaldos diarios configurados', 'Accesos entregados al equipo del cliente'] } },
  { usuario: 'smendez', ruta: 'Proyectos/Proyecto Atlas', nombre: 'Cronograma Atlas.txt', categoria: 'administrativo', etiquetas: ['atlas', 'cronograma'], fecha: '2026-06-10T09:00',
    plantilla: 'lista', datos: { titulo: 'Cronograma del Proyecto Atlas', elementos: ['Junio: levantamiento de información', 'Julio-agosto: diseño', 'Septiembre-octubre: implementación', 'Noviembre: entrega final'] } },
  { usuario: 'smendez', ruta: 'Proyectos/Proyecto Quetzal', nombre: 'Propuesta técnica Quetzal.md', categoria: 'contrato', etiquetas: ['quetzal', 'propuesta'], fecha: '2026-08-25T11:20',
    plantilla: 'contrato', datos: { cliente: 'Municipalidad de Quetzaltenango', servicio: 'modernización de procesos administrativos', monto: 35000, meses: 8, fecha: '2026-08-25', firmante: 'Sofía Alejandra Méndez, Gerente de Proyectos' } },
  { usuario: 'smendez', ruta: 'Reuniones', nombre: 'Reunión de arranque Quetzal.md', categoria: 'informe', etiquetas: ['quetzal', 'reunión'], fecha: '2026-09-14T15:45',
    plantilla: 'acta', datos: { titulo: 'Arranque del Proyecto Quetzal', fecha: '2026-09-14', asistentes: ['Sofía Alejandra Méndez', 'Laura Beatriz Hernández', 'Diego Andrés Pérez'], temas: ['Presentación del equipo', 'Alcance y cronograma'], acuerdos: ['Enviar cronograma al cliente', 'Agendar visita de campo'] } },
  { usuario: 'smendez', ruta: '', nombre: 'Lecciones aprendidas.md', categoria: 'otro', etiquetas: ['lecciones'], fecha: '2026-10-15T10:10',
    plantilla: 'politica', datos: { titulo: 'Lecciones aprendidas de proyectos 2026', area: 'Proyectos', version: '0.3', puntos: ['Validar el alcance por escrito antes de iniciar.', 'Revisar el presupuesto cada quincena.', 'Documentar todo en Black Vault.'] } },

  // ------------------------------------------------------------ rcastillo (Contabilidad) · 4
  { usuario: 'rcastillo', ruta: 'Cierres contables/2026', nombre: 'Cierre contable - junio.md', categoria: 'informe', etiquetas: ['cierre', 'mensual'], fecha: '2026-07-06T17:00',
    plantilla: 'informe', datos: { titulo: 'Cierre contable', periodo: 'junio de 2026', indicadores: [['Partidas registradas', '—', '1,284'], ['Ajustes', '< 10', '7']], conclusion: 'Cierre realizado sin observaciones relevantes.' } },
  { usuario: 'rcastillo', ruta: 'Cierres contables/2026', nombre: 'Cierre contable - septiembre.md', categoria: 'informe', etiquetas: ['cierre', 'mensual'], fecha: '2026-10-06T17:20',
    plantilla: 'informe', datos: { titulo: 'Cierre contable', periodo: 'septiembre de 2026', indicadores: [['Partidas registradas', '—', '1,402'], ['Ajustes', '< 10', '12']], conclusion: 'Se excedió el número de ajustes; revisar la causa con Finanzas.' } },
  { usuario: 'rcastillo', ruta: 'Conciliaciones', nombre: 'Conciliación bancaria agosto.txt', categoria: 'informe', etiquetas: ['conciliación', 'banco'], fecha: '2026-09-04T10:30',
    plantilla: 'presupuesto', datos: { titulo: 'CONCILIACIÓN BANCARIA - AGOSTO', partidas: [['Saldo según banco', 512300.4], ['Depósitos en tránsito', 18450], ['Cheques pendientes', -22300]] } },
  { usuario: 'rcastillo', ruta: '', nombre: 'Memorándum - facturas electrónicas.txt', categoria: 'administrativo', etiquetas: ['memorándum', 'fel'], fecha: '2026-08-20T09:00',
    plantilla: 'memo', datos: { para: 'Finanzas y Comercial', de: 'Ricardo Castillo Ordóñez', asunto: 'Facturas electrónicas (FEL)', fecha: '20 de agosto de 2026', cuerpo: 'Toda factura debe emitirse en el sistema FEL el mismo día del servicio.' } },

  // ------------------------------------------------------------ lhernandez (Comercial) · 4
  { usuario: 'lhernandez', ruta: 'Propuestas', nombre: 'Propuesta comercial - Constructora Pacífico.md', categoria: 'contrato', etiquetas: ['propuesta', 'cliente'], fecha: '2026-06-17T14:00',
    plantilla: 'contrato', datos: { cliente: 'Constructora Pacífico, S.A.', servicio: 'gestión de proyectos de construcción', monto: 28000, meses: 10, fecha: '2026-06-17', firmante: 'Laura Beatriz Hernández, Gerente Comercial' } },
  { usuario: 'lhernandez', ruta: 'Propuestas', nombre: 'Tarifario 2026.txt', categoria: 'administrativo', etiquetas: ['tarifas'], fecha: '2026-05-22T09:00',
    plantilla: 'presupuesto', datos: { titulo: 'TARIFARIO DE SERVICIOS 2026 (por hora)', partidas: [['Consultor junior', 350], ['Consultor senior', 650], ['Gerente de proyecto', 900]] } },
  { usuario: 'lhernandez', ruta: 'Clientes/Agrícola del Sur', nombre: 'Minuta de visita.md', categoria: 'informe', etiquetas: ['visita', 'cliente'], fecha: '2026-07-09T12:30',
    plantilla: 'acta', datos: { titulo: 'Visita a Agrícola del Sur', fecha: '2026-07-09', asistentes: ['Laura Beatriz Hernández', 'Gerencia de Agrícola del Sur'], temas: ['Satisfacción con el servicio', 'Nuevas necesidades'], acuerdos: ['Enviar propuesta de auditoría interna'] } },
  { usuario: 'lhernandez', ruta: '', nombre: 'Contactos de prospectos.txt', categoria: 'otro', etiquetas: ['prospectos'], fecha: '2026-09-21T11:00',
    plantilla: 'lista', datos: { titulo: 'Prospectos del trimestre', elementos: ['Exportadora del Norte', 'Hotel Lago Azul', 'Distribuidora Central'] } },

  // ------------------------------------------------------------ dperez (Tecnología) · 3
  { usuario: 'dperez', ruta: 'Infraestructura', nombre: 'Inventario de equipos.md', categoria: 'informe', etiquetas: ['inventario', 'ti'], fecha: '2026-06-02T09:30',
    plantilla: 'informe', datos: { titulo: 'Inventario de equipos de cómputo', periodo: 'junio de 2026', indicadores: [['Portátiles', '30', '28'], ['Equipos con garantía vigente', '100 %', '86 %']], conclusion: 'Se recomienda renovar 4 equipos en el cuarto trimestre.' } },
  { usuario: 'dperez', ruta: 'Manuales', nombre: 'Manual de uso de Black Vault.md', categoria: 'administrativo', etiquetas: ['manual', 'black vault'], fecha: '2026-06-12T10:00',
    plantilla: 'procedimiento', datos: { titulo: 'Uso de Black Vault para el personal', codigo: 'TI-MAN-001', pasos: ['Inicia sesión con tu usuario o correo.', 'Organiza tus documentos en carpetas.', 'Comparte solo lo necesario y con el permiso mínimo.', 'Lo que eliminas va a la papelera; puedes restaurarlo.'] } },
  { usuario: 'dperez', ruta: '', nombre: 'Política de contraseñas.md', categoria: 'administrativo', etiquetas: ['política', 'seguridad'], fecha: '2026-07-01T08:00',
    plantilla: 'politica', datos: { titulo: 'Política de contraseñas', area: 'Tecnología', version: '1.0', puntos: ['Mínimo 8 caracteres combinando letras y números.', 'No reutilizar contraseñas de otros servicios.', 'Cambiar la contraseña si se sospecha que fue expuesta.'] } },

  // ------------------------------------------------------------ vrodriguez (Calidad) · 2
  { usuario: 'vrodriguez', ruta: 'Auditorías internas', nombre: 'Plan de auditoría interna 2026.md', categoria: 'informe', etiquetas: ['auditoría', 'plan'], fecha: '2026-06-24T09:15',
    plantilla: 'informe', datos: { titulo: 'Plan de auditoría interna', periodo: '2026', indicadores: [['Procesos a auditar', '8', '8'], ['Auditorías realizadas', '4', '3']], conclusion: 'Se reprogramó la auditoría de compras para octubre.' } },
  { usuario: 'vrodriguez', ruta: 'Normas', nombre: 'Control de documentos.md', categoria: 'administrativo', etiquetas: ['norma', 'documentos'], fecha: '2026-08-12T14:25',
    plantilla: 'politica', datos: { titulo: 'Norma de control de documentos', area: 'Calidad', version: '3.1', puntos: ['Todo documento vigente se guarda en Black Vault.', 'Las versiones obsoletas se envían a la papelera.', 'Solo el dueño del documento lo comparte.'] } },

  // ------------------------------------------------------------ fsoto (Auditoría) · 1
  { usuario: 'fsoto', ruta: 'Hallazgos', nombre: 'Hallazgos de auditoría - compras.md', categoria: 'informe', etiquetas: ['auditoría', 'hallazgos'], fecha: '2026-10-09T16:00',
    plantilla: 'informe', datos: { titulo: 'Hallazgos de auditoría: compras', periodo: 'enero a septiembre de 2026', indicadores: [['Compras revisadas', '50', '50'], ['Sin tres cotizaciones', '0', '4']], conclusion: 'Cuatro compras no cumplieron el procedimiento OP-COM-002.' } },

  // ------------------------------------------------------------ pjuarez (inactiva) · 1
  { usuario: 'pjuarez', ruta: 'Entregas finales', nombre: 'Informe de entrega de puesto.md', categoria: 'informe', etiquetas: ['entrega'], fecha: '2026-09-28T15:00',
    descripcion: 'Entregado antes de su salida: se conserva aunque la cuenta esté desactivada.', plantilla: 'informe', datos: { titulo: 'Entrega de puesto', periodo: 'mayo a septiembre de 2026', indicadores: [['Expedientes entregados', '25', '25'], ['Pendientes', '0', '2']], conclusion: 'Quedan dos pendientes asignados a Recursos Humanos.' } },
];
