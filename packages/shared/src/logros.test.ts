import { calcularLogros, type EntradaLogros, type IdLogro } from './logros';
import { rangoDeDias, sumarDias } from './fechas';

const HOY = '2026-07-28';

/** Los últimos `n` días naturales terminando hoy, para armar rachas. */
function ultimosDias(n: number, hasta = HOY): string[] {
  return rangoDeDias(sumarDias(hasta, -(n - 1)), hasta);
}

function entrada(overrides: Partial<EntradaLogros> = {}): EntradaLogros {
  return {
    diasConRegistro: [],
    diasConMetaAgua: [],
    diasConEjercicio: [],
    pesoInicial: null,
    pesoActual: null,
    pesoMeta: null,
    hoy: HOY,
    ...overrides,
  };
}

function logro(entradaLogros: EntradaLogros, id: IdLogro) {
  const encontrado = calcularLogros(entradaLogros).find((item) => item.id === id);
  if (!encontrado) throw new Error(`No existe el logro ${id}`);
  return encontrado;
}

describe('calcularLogros', () => {
  it('devuelve el catálogo completo aunque no haya registros', () => {
    const logros = calcularLogros(entrada());

    expect(logros).toHaveLength(6);
    expect(logros.every((item) => !item.conseguido)).toBe(true);
    expect(logros.every((item) => item.progreso === 0)).toBe(true);
  });

  describe('racha de días', () => {
    it.each([
      [0, 0, false],
      [3, 0.43, false],
      [7, 1, true],
      [12, 1, true],
    ])('con %i días seguidos da progreso %f', (dias, progreso, conseguido) => {
      const resultado = logro(entrada({ diasConRegistro: ultimosDias(dias) }), 'racha_dias');

      expect(resultado.progreso).toBeCloseTo(progreso, 2);
      expect(resultado.conseguido).toBe(conseguido);
    });

    it('no rompe la racha por no haber registrado todavía hoy', () => {
      // La racha termina ayer: el día en curso aún no acaba.
      const hastaAyer = ultimosDias(7, sumarDias(HOY, -1));

      expect(logro(entrada({ diasConRegistro: hastaAyer }), 'racha_dias').conseguido).toBe(true);
    });
  });

  describe('meta de agua', () => {
    it('cuenta los días de la última semana que cumplieron la meta', () => {
      const resultado = logro(entrada({ diasConMetaAgua: ultimosDias(4) }), 'agua_meta');

      expect(resultado.progreso).toBeCloseTo(0.57, 2);
      expect(resultado.conseguido).toBe(false);
    });

    it('ignora los días fuera de la ventana de siete días', () => {
      const viejos = rangoDeDias('2026-06-01', '2026-06-30');

      expect(logro(entrada({ diasConMetaAgua: viejos }), 'agua_meta').progreso).toBe(0);
    });
  });

  describe('semana completa', () => {
    it('exige los siete días de la última semana', () => {
      expect(logro(entrada({ diasConRegistro: ultimosDias(7) }), 'semana_completa').conseguido).toBe(
        true,
      );
    });

    it('no se consigue con seis días, aunque no sean consecutivos los que faltan', () => {
      const conHueco = ultimosDias(7).filter((dia) => dia !== sumarDias(HOY, -3));

      expect(logro(entrada({ diasConRegistro: conHueco }), 'semana_completa').conseguido).toBe(
        false,
      );
    });
  });

  describe('primeros kilos', () => {
    it('mide los kilos bajados desde el peso inicial', () => {
      const resultado = logro(entrada({ pesoInicial: 82, pesoActual: 80 }), 'primeros_kg');

      expect(resultado.conseguido).toBe(true);
      expect(resultado.progreso).toBe(1);
    });

    it('no cuenta progreso negativo si el paciente subió de peso', () => {
      const resultado = logro(entrada({ pesoInicial: 80, pesoActual: 82 }), 'primeros_kg');

      expect(resultado.progreso).toBe(0);
      expect(resultado.conseguido).toBe(false);
    });

    it('queda en cero mientras solo haya un pesaje', () => {
      expect(logro(entrada({ pesoInicial: 80, pesoActual: null }), 'primeros_kg').progreso).toBe(0);
    });
  });

  describe('peso meta', () => {
    it('queda bloqueado mientras el expediente no guarde un peso objetivo', () => {
      const resultado = logro(entrada({ pesoInicial: 82, pesoActual: 75 }), 'peso_meta');

      expect(resultado.conseguido).toBe(false);
      expect(resultado.progreso).toBe(0);
    });

    it('mide el camino recorrido sobre el camino total', () => {
      const resultado = logro(
        entrada({ pesoInicial: 80, pesoActual: 77, pesoMeta: 74 }),
        'peso_meta',
      );

      expect(resultado.progreso).toBeCloseTo(0.5, 2);
    });

    it('también avanza cuando la meta es ganar peso', () => {
      const resultado = logro(
        entrada({ pesoInicial: 60, pesoActual: 63, pesoMeta: 66 }),
        'peso_meta',
      );

      expect(resultado.progreso).toBeCloseTo(0.5, 2);
      expect(resultado.conseguido).toBe(false);
    });

    it('se consigue al alcanzar la meta', () => {
      const resultado = logro(
        entrada({ pesoInicial: 80, pesoActual: 74, pesoMeta: 74 }),
        'peso_meta',
      );

      expect(resultado.conseguido).toBe(true);
      expect(resultado.progreso).toBe(1);
    });
  });

  describe('días activo', () => {
    it('cuenta días distintos, no registros repetidos', () => {
      const resultado = logro(
        entrada({ diasConEjercicio: ['2026-07-20', '2026-07-20', '2026-07-21'] }),
        'dias_activo',
      );

      expect(resultado.progreso).toBeCloseTo(0.2, 2);
    });

    it('no tiene ventana: cuenta desde siempre', () => {
      const resultado = logro(
        entrada({ diasConEjercicio: rangoDeDias('2026-01-01', '2026-01-10') }),
        'dias_activo',
      );

      expect(resultado.conseguido).toBe(true);
    });
  });

  it('nunca reporta un progreso mayor que uno', () => {
    const logros = calcularLogros(
      entrada({
        diasConRegistro: ultimosDias(60),
        diasConMetaAgua: ultimosDias(60),
        diasConEjercicio: rangoDeDias('2026-01-01', '2026-07-28'),
        pesoInicial: 90,
        pesoActual: 70,
        pesoMeta: 80,
      }),
    );

    expect(logros.every((item) => item.progreso <= 1)).toBe(true);
  });
});
