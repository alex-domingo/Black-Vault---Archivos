import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Misma política que el servidor: al menos 8 caracteres, como máximo 72 bytes
 * (límite de bcrypt) y una combinación de letras y números.
 */
export const claveSegura: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value as string | null;
  if (!valor) return null; // de lo vacío se encarga Validators.required
  if (valor.length < 8) return { claveCorta: true };
  if (new TextEncoder().encode(valor).length > 72) return { claveLarga: true };
  if (!/\p{L}/u.test(valor) || !/\d/.test(valor)) return { claveSinCombinar: true };
  return null;
};

/** Mensaje en español para los errores de claveSegura. */
export function mensajeClave(control: AbstractControl): string {
  if (control.hasError('required')) return 'La contraseña es obligatoria.';
  if (control.hasError('claveCorta')) return 'Debe tener al menos 8 caracteres.';
  if (control.hasError('claveLarga')) return 'Es demasiado larga (máximo 72 bytes).';
  if (control.hasError('claveSinCombinar')) return 'Debe combinar letras y números.';
  return '';
}

/** Valida en el grupo que dos campos tengan el mismo valor; marca el error en el segundo. */
export function camposIguales(campo: string, confirmacion: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const control = grupo.get(confirmacion);
    if (!control) return null;
    const distintos = grupo.get(campo)?.value !== control.value;
    const errores = { ...(control.errors ?? {}) };
    if (distintos && control.value) errores['noCoincide'] = true;
    else delete errores['noCoincide'];
    control.setErrors(Object.keys(errores).length ? errores : null);
    return null;
  };
}

/** Mismo patrón que el servidor para nombres de usuario. */
export const PATRON_NOMBRE_USUARIO = /^[a-z0-9._-]{3,30}$/;
