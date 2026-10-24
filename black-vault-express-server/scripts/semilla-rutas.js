// Índice "usuario|ruta legible" → documento, para que los datos de la semilla puedan
// referirse a carpetas y archivos por su ruta ("Contratos/2026/Clientes/Contrato.md").

/** @returns {(tipo: 'carpeta'|'archivo', usuario: string, ruta: string) => object} */
export function crearBuscadorDeRutas(usuarios, carpetas, archivos, prefijoError = 'Datos de la semilla incoherentes') {
  const porId = new Map(usuarios.map((u) => [u._id.toString(), u]));
  const carpetaPorId = new Map(carpetas.map((c) => [c._id.toString(), c]));
  const rutaDe = (doc) => [...doc.ancestros.map((id) => carpetaPorId.get(id.toString()).nombre), doc.nombre].join('/');
  const indice = { carpeta: new Map(), archivo: new Map() };
  for (const c of carpetas) indice.carpeta.set(`${porId.get(c.propietarioId.toString()).nombreUsuario}|${rutaDe(c)}`, c);
  for (const a of archivos) indice.archivo.set(`${porId.get(a.propietarioId.toString()).nombreUsuario}|${rutaDe(a)}`, a);
  return (tipo, usuario, ruta) => {
    const doc = indice[tipo].get(`${usuario}|${ruta}`);
    if (!doc) throw new Error(`${prefijoError}: no existe ${tipo} "${ruta}" de ${usuario}`);
    return doc;
  };
}
