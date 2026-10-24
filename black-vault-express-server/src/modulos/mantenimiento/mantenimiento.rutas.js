import { Router } from 'express';
import { autenticar, requerirRol } from '../../middlewares/autenticar.js';
import { verificarIntegridad } from '../../servicios/integridad.js';

// Solo administradores. La reparación se hace con el script `npm run integridad -- --reparar`,
// para que nadie modifique datos desde el navegador sin revisar antes el informe.
const rutas = Router();
rutas.use(autenticar, requerirRol('administrador'));

rutas.get('/integridad', async (req, res) => {
  res.json(await verificarIntegridad());
});

export default rutas;
