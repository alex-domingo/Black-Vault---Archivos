// GET /api/almacenamiento: espacio usado por el usuario, desglosado con aggregation.
import { Router } from 'express';
import { coleccion } from '../../bd/conexion.js';
import { autenticar } from '../../middlewares/autenticar.js';

const rutas = Router();
rutas.use(autenticar);

rutas.get('/', async (req, res) => {
  const [desglose] = await coleccion('archivos')
    .aggregate([
      { $match: { propietarioId: req.usuario._id } },
      {
        $facet: {
          porTipo: [
            { $match: { enPapelera: false } },
            { $group: { _id: '$extension', archivos: { $sum: 1 }, bytes: { $sum: '$contenido.bytes' } } },
            { $project: { _id: 0, extension: '$_id', archivos: 1, bytes: 1 } },
            { $sort: { bytes: -1 } },
          ],
          enPapelera: [
            { $match: { enPapelera: true } },
            { $group: { _id: null, archivos: { $sum: 1 }, bytes: { $sum: '$contenido.bytes' } } },
            { $project: { _id: 0 } },
          ],
        },
      },
    ])
    .toArray();

  res.json({
    usadoBytes: req.usuario.almacenamiento.usadoBytes,
    cuotaBytes: req.usuario.almacenamiento.cuotaBytes,
    porTipo: desglose.porTipo,
    enPapelera: desglose.enPapelera[0] ?? { archivos: 0, bytes: 0 },
  });
});

export default rutas;
