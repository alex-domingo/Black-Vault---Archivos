import { HttpResponse } from '@angular/common/http';

/** Extrae el nombre del archivo de Content-Disposition (admite filename*=UTF-8'' con tildes). */
export function nombreDesdeCabecera(cabecera: string | null, porDefecto: string): string {
  if (!cabecera) return porDefecto;
  const extendido = /filename\*=UTF-8''([^;]+)/i.exec(cabecera);
  if (extendido) {
    try {
      return decodeURIComponent(extendido[1]);
    } catch {
      // continúa con el formato simple
    }
  }
  const simple = /filename="?([^";]+)"?/i.exec(cabecera);
  return simple?.[1] ?? porDefecto;
}

/** Ofrece al navegador un Blob para guardarlo con el nombre indicado. */
export function guardarRespuesta(respuesta: HttpResponse<Blob>, porDefecto: string): void {
  if (!respuesta.body) return;
  const nombre = nombreDesdeCabecera(respuesta.headers.get('Content-Disposition'), porDefecto);
  const url = URL.createObjectURL(respuesta.body);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
