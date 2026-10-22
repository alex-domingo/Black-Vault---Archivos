import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Sesion } from '../servicios/sesion';

/** Solo con sesión iniciada. Si no, lleva al inicio de sesión recordando a dónde se quería ir. */
export const requiereSesion: CanActivateFn = async (_ruta, estado) => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  if (await sesion.asegurarUsuario()) return true;
  return router.createUrlTree(['/iniciar-sesion'], { queryParams: { volver: estado.url } });
};

/** Solo administradores. Los demás vuelven a Mi unidad. El servidor aplica la misma regla. */
export const requiereAdministrador: CanActivateFn = async () => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  if ((await sesion.asegurarUsuario()) && sesion.esAdministrador()) return true;
  return router.createUrlTree(['/mi-unidad']);
};

/** La página de inicio de sesión solo tiene sentido sin sesión. */
export const soloSinSesion: CanActivateFn = async () => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  return (await sesion.asegurarUsuario()) ? router.createUrlTree(['/mi-unidad']) : true;
};
