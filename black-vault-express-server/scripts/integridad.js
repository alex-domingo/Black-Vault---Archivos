// Verificación de integridad de la base (npm run integridad).
// Uso:  npm run integridad               (solo informa)
//       npm run integridad -- --reparar  (repara lo que se puede y vuelve a verificar)
import { conectar, desconectar } from '../src/bd/conexion.js';
import { repararIntegridad, verificarIntegridad } from '../src/servicios/integridad.js';

function mostrar(informe) {
  console.table(informe.verificaciones.map((v) => ({ verificación: v.titulo, problemas: v.problemas })));
  for (const v of informe.verificaciones.filter((x) => x.problemas > 0)) {
    console.log(`\n${v.titulo} (${v.problemas}): ${v.descripcion}`);
    for (const e of v.ejemplos) console.log('  -', JSON.stringify(e));
  }
  console.log(informe.correcto ? '\n✔ La base de datos está íntegra.' : '\n✘ Se encontraron problemas.');
}

try {
  await conectar();
  const informe = await verificarIntegridad();
  mostrar(informe);
  if (!informe.correcto && process.argv.includes('--reparar')) {
    console.log('\nReparando…');
    const { reparado, pendientes } = await repararIntegridad();
    console.table([reparado]);
    for (const p of pendientes) console.log('  Requiere revisión manual:', p);
    mostrar(await verificarIntegridad());
  }
  if (!informe.correcto) process.exitCode = 1;
} catch (error) {
  console.error('La verificación falló:', error.message);
  process.exitCode = 1;
} finally {
  await desconectar();
}
