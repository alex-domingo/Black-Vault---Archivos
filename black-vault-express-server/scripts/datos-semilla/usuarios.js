// Usuarios de la carga inicial. Las fechas están en hora de Guatemala.
// Las contraseñas se documentan en el README para poder calificar el proyecto.

export const CLAVE_ADMINISTRADOR = 'Admin2026';
export const CLAVE_USUARIOS = 'Usuario2026';

export const USUARIOS_SEMILLA = [
  { nombreUsuario: 'admin', nombreCompleto: 'Administrador del Sistema', rol: 'administrador', cuotaMb: 500, creadoEn: '2026-05-04T08:00' },
  { nombreUsuario: 'mlopez', nombreCompleto: 'María Fernanda López', creadoEn: '2026-05-04T09:15' },
  { nombreUsuario: 'jramirez', nombreCompleto: 'José Antonio Ramírez', creadoEn: '2026-05-04T09:20' },
  { nombreUsuario: 'agarcia', nombreCompleto: 'Ana Lucía García', creadoEn: '2026-05-04T09:30' },
  { nombreUsuario: 'cmorales', nombreCompleto: 'Carlos Eduardo Morales', creadoEn: '2026-05-05T10:00' },
  { nombreUsuario: 'smendez', nombreCompleto: 'Sofía Alejandra Méndez', creadoEn: '2026-05-05T10:20' },
  { nombreUsuario: 'rcastillo', nombreCompleto: 'Ricardo Castillo Ordóñez', creadoEn: '2026-05-06T11:00' },
  { nombreUsuario: 'lhernandez', nombreCompleto: 'Laura Beatriz Hernández', creadoEn: '2026-05-06T11:30' },
  { nombreUsuario: 'dperez', nombreCompleto: 'Diego Andrés Pérez', creadoEn: '2026-05-07T08:45' },
  { nombreUsuario: 'vrodriguez', nombreCompleto: 'Valeria Rodríguez Muñoz', creadoEn: '2026-05-07T09:10' },
  { nombreUsuario: 'fsoto', nombreCompleto: 'Fernando Soto Cifuentes', creadoEn: '2026-05-08T14:00' },
  // Exempleada: demuestra que desactivar no borra su información (RN-09).
  { nombreUsuario: 'pjuarez', nombreCompleto: 'Paola Juárez Estrada', creadoEn: '2026-05-08T14:20', desactivadoEn: '2026-09-30T17:00' },
];
