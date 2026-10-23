// Configuración de desarrollo (ng serve). Reemplaza a environment.ts según angular.json.
export const environment = {
  produccion: false,
  urlApi: 'http://localhost:8000/api',
  // Debe coincidir con TAMANO_MAXIMO_MB del servidor (el servidor siempre vuelve a validar).
  tamanoMaximoMb: 5,
};
