// Configuración de producción (ng build).
export const environment = {
  produccion: true,
  urlApi: 'http://localhost:8000/api',
  // Debe coincidir con TAMANO_MAXIMO_MB del servidor (el servidor siempre vuelve a validar).
  tamanoMaximoMb: 5,
};
