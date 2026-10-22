import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { ErrorApi } from '../modelos/error-api';
import { RespuestaSesion, Usuario } from '../modelos/usuario';
import { AutenticacionApi } from './autenticacion-api';

const CLAVE_ALMACENAMIENTO = 'black-vault.token';

/** El almacenamiento del navegador puede no estar disponible (modo privado estricto, etc.). */
function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_ALMACENAMIENTO);
  } catch {
    return null;
  }
}

function guardarToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(CLAVE_ALMACENAMIENTO, token);
    else localStorage.removeItem(CLAVE_ALMACENAMIENTO);
  } catch {
    // Sin almacenamiento la sesión dura lo que dure la pestaña.
  }
}

/**
 * Estado de la sesión: token JWT y usuario actual.
 * El token se guarda en localStorage para sobrevivir a recargas; el servidor
 * vuelve a validar al usuario en cada petición.
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly api = inject(AutenticacionApi);
  private readonly router = inject(Router);

  private readonly tokenActual = signal<string | null>(leerToken());
  private readonly usuarioActual = signal<Usuario | null>(null);

  readonly token = this.tokenActual.asReadonly();
  readonly usuario = this.usuarioActual.asReadonly();
  readonly autenticado = computed(() => this.tokenActual() !== null && this.usuarioActual() !== null);
  readonly esAdministrador = computed(() => this.usuarioActual()?.rol === 'administrador');

  iniciarSesion(identificador: string, clave: string): Observable<RespuestaSesion> {
    return this.api.iniciarSesion(identificador, clave).pipe(tap((respuesta) => this.establecer(respuesta)));
  }

  /** Aplica una respuesta de sesión (login o cambio de contraseña). */
  establecer({ token, usuario }: RespuestaSesion): void {
    guardarToken(token);
    this.tokenActual.set(token);
    this.usuarioActual.set(usuario);
  }

  actualizarUsuario(usuario: Usuario): void {
    this.usuarioActual.set(usuario);
  }

  /**
   * Garantiza que el usuario esté cargado. Si hay token pero aún no hay usuario
   * (por ejemplo, tras recargar la página), lo pide al servidor.
   * Solo descarta el token si el servidor lo rechaza (401).
   */
  async asegurarUsuario(): Promise<boolean> {
    if (this.usuarioActual()) return true;
    if (!this.tokenActual()) return false;
    try {
      this.usuarioActual.set(await firstValueFrom(this.api.perfil()));
      return true;
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 401) this.limpiar();
      return false;
    }
  }

  /** Cierre voluntario: avisa al servidor (para el historial) y vuelve al inicio de sesión. */
  async cerrarSesion(): Promise<void> {
    try {
      await firstValueFrom(this.api.cerrarSesion());
    } catch {
      // Aunque el servidor no responda, la sesión se cierra en el navegador.
    }
    this.limpiar();
    await this.router.navigate(['/iniciar-sesion']);
  }

  /** La sesión dejó de ser válida (expiró, se cambió la clave o se desactivó la cuenta). */
  expirar(): void {
    if (!this.tokenActual()) return;
    const volver = this.router.url.startsWith('/iniciar-sesion') ? undefined : this.router.url;
    this.limpiar();
    void this.router.navigate(['/iniciar-sesion'], { queryParams: { motivo: 'expirada', volver } });
  }

  private limpiar(): void {
    guardarToken(null);
    this.tokenActual.set(null);
    this.usuarioActual.set(null);
  }
}
