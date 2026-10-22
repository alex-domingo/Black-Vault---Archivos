export type Rol = 'administrador' | 'usuario';

/** Usuario tal como lo devuelve la API (sin hash de contraseña). Las fechas llegan en ISO. */
export interface Usuario {
  _id: string;
  nombreUsuario: string;
  correo: string;
  nombreCompleto: string;
  rol: Rol;
  activo: boolean;
  almacenamiento: { usadoBytes: number; cuotaBytes: number };
  ultimoAcceso: string | null;
  desactivadoEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Respuesta de iniciar sesión y de cambiar la contraseña. */
export interface RespuestaSesion {
  token: string;
  expiraEn: string;
  usuario: Usuario;
}

/** Entrada del directorio de usuarios (para compartir). */
export interface UsuarioDirectorio {
  _id: string;
  nombreUsuario: string;
  nombreCompleto: string;
  correo: string;
}

export interface Paginado<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
}

export interface FiltroUsuarios {
  buscar?: string;
  rol?: Rol;
  activo?: boolean;
  pagina: number;
  limite: number;
}

export interface DatosNuevoUsuario {
  nombreUsuario: string;
  correo: string;
  nombreCompleto: string;
  rol: Rol;
  clave: string;
  cuotaMb?: number;
}

export interface CambiosUsuario {
  correo?: string;
  nombreCompleto?: string;
  rol?: Rol;
  cuotaMb?: number;
}
