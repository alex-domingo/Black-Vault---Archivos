/** Descarga una tabla como CSV (UTF-8 con BOM, para que Excel respete tildes y eñes). */
export function descargarCsv(nombre: string, encabezados: string[], filas: (string | number | null | undefined)[][]): void {
  const celda = (valor: string | number | null | undefined) => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const contenido = [encabezados, ...filas].map((fila) => fila.map(celda).join(',')).join('\r\n');
  const blob = new Blob(['﻿', contenido], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre.endsWith('.csv') ? nombre : `${nombre}.csv`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 0);
}
