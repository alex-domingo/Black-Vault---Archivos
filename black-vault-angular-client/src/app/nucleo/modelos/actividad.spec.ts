import { ACCIONES, Actividad, describirActividad } from './actividad';

const maria = { _id: 'u1', nombreUsuario: 'mlopez', nombreCompleto: 'María Fernanda López', rol: 'usuario' };
const jose = { _id: 'u2', nombreUsuario: 'jramirez', nombreCompleto: 'José Antonio Ramírez' };
const base = (datos: Partial<Actividad>): Actividad => ({
  _id: 'a1',
  accion: 'ARCHIVO_SUBIDO',
  categoria: 'archivos',
  fecha: '2026-10-22T15:00:00.000Z',
  actor: maria,
  recurso: { tipo: 'archivo', _id: 'r1', nombre: 'Plan.md', propietarioId: 'u1' },
  ...datos,
});
const texto = (a: Actividad, yo: string | null) => describirActividad(a, yo).map((f) => f.texto).join('');

describe('describirActividad', () => {
  it('conjuga en segunda persona cuando quien lee es quien actuó', () => {
    const a = base({ detalles: { carpeta: { _id: 'c1', nombre: 'Proyectos' } } });
    expect(texto(a, 'u1')).toBe('Tú subiste «Plan.md» a Proyectos');
    expect(texto(a, 'u9')).toBe('María Fernanda López subió «Plan.md» a Proyectos');
  });

  it('describe comparticiones con la persona afectada y el permiso', () => {
    const a = base({ accion: 'COMPARTICION_CREADA', categoria: 'comparticiones', usuarioAfectado: jose, detalles: { permiso: 'comentario' } });
    expect(texto(a, 'u2')).toBe('María Fernanda López compartió «Plan.md» contigo (comentar)');
    expect(texto(a, 'u9')).toBe('María Fernanda López compartió «Plan.md» con José Antonio Ramírez (comentar)');
    const cambio = base({ accion: 'COMPARTICION_MODIFICADA', usuarioAfectado: jose, detalles: { permisoAnterior: 'lectura', permisoNuevo: 'edicion' } });
    expect(texto(cambio, 'u1')).toBe('Tú cambiaste el permiso de José Antonio Ramírez sobre «Plan.md» de lectura a edición');
    expect(texto(cambio, 'u2')).toBe('María Fernanda López cambió tu permiso sobre «Plan.md» de lectura a edición');
    const retiro = base({ accion: 'COMPARTICION_RETIRADA', usuarioAfectado: jose });
    expect(texto(retiro, 'u2')).toBe('María Fernanda López te quitó el acceso a «Plan.md»');
    const cuenta = base({ accion: 'USUARIO_DESACTIVADO', usuarioAfectado: jose, recurso: undefined });
    expect(texto(cuenta, 'u2')).toBe('María Fernanda López desactivó tu cuenta');
  });

  it('resalta personas y recursos', () => {
    const partes = describirActividad(base({ accion: 'ARCHIVO_CONSULTADO' }), 'u9');
    expect(partes.filter((p) => p.resaltado).map((p) => p.texto)).toEqual(['María Fernanda López', '«Plan.md»']);
  });

  it('la papelera menciona destino, cambio de nombre y espacio liberado', () => {
    const restaurado = base({ accion: 'ARCHIVO_RESTAURADO', detalles: { destino: null, nombreAnterior: 'Plan viejo.md' } });
    expect(texto(restaurado, 'u1')).toBe('Tú restauraste «Plan.md» (antes «Plan viejo.md») en Mi unidad');
    const vaciada = base({ accion: 'PAPELERA_VACIADA', recurso: undefined, detalles: { archivos: 3, bytes: 2048 } });
    expect(texto(vaciada, 'u1')).toBe('Tú vaciaste tu papelera (3 archivos, 2.0 KB liberados)');
  });

  it('cada acción del catálogo produce una frase propia', () => {
    for (const { valor } of ACCIONES) {
      const frase = texto(base({ accion: valor, usuarioAfectado: jose, detalles: {} }), 'u9');
      expect(frase).not.toContain(valor);
    }
  });
});
