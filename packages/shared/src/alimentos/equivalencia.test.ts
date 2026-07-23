import {
  equivalentesSugeridos,
  macrosDeEquivalentes,
  verificarEquivalentes,
} from './equivalencia';

describe('macrosDeEquivalentes', () => {
  it('convierte un equivalente de cereal a su aporte promedio', () => {
    expect(macrosDeEquivalentes({ cereales: 1 })).toEqual({
      energia_kcal: 70,
      proteina_g: 2,
      carbohidratos_g: 15,
      lipidos_g: 0,
    });
  });

  it('suma los aportes de varios grupos', () => {
    const macros = macrosDeEquivalentes({ cereales: 2, aceites: 1 });

    expect(macros.energia_kcal).toBe(185);
    expect(macros.lipidos_g).toBe(5);
  });

  it('escala las fracciones de equivalente', () => {
    expect(macrosDeEquivalentes({ frutas: 0.5 }).energia_kcal).toBe(30);
  });

  it('ignora el grupo libres, que por definición no aporta energía', () => {
    expect(macrosDeEquivalentes({ libres: 3 }).energia_kcal).toBe(0);
  });

  it('devuelve ceros cuando no hay equivalentes', () => {
    expect(macrosDeEquivalentes({}).energia_kcal).toBe(0);
  });
});

describe('equivalentesSugeridos', () => {
  it('reparte la energía de la porción en equivalentes de su grupo', () => {
    expect(equivalentesSugeridos('cereales', 70)).toEqual({ cereales: 1 });
  });

  it('redondea a cuartos de equivalente, que es como se receta', () => {
    // 90 / 70 = 1.29 → 1.25
    expect(equivalentesSugeridos('cereales', 90)).toEqual({ cereales: 1.25 });
  });

  it('devuelve lo que sugiere una porción doble', () => {
    expect(equivalentesSugeridos('leguminosas', 240)).toEqual({ leguminosas: 2 });
  });

  it('no asigna equivalentes al grupo de alimentos libres', () => {
    expect(equivalentesSugeridos('libres', 15)).toEqual({});
  });

  it('no asigna nada cuando la porción no llega a un cuarto de equivalente', () => {
    expect(equivalentesSugeridos('leguminosas', 5)).toEqual({});
  });

  it('lo que sugiere siempre pasa su propia verificación', () => {
    for (const kcal of [30, 70, 120, 250]) {
      const sugeridos = equivalentesSugeridos('cereales', kcal);
      expect(verificarEquivalentes({ energia_kcal: kcal, equivalentes: sugeridos }).coherente).toBe(
        true,
      );
    }
  });
});

describe('verificarEquivalentes', () => {
  it('aprueba un alimento cuyas kcal coinciden con sus equivalentes', () => {
    const revision = verificarEquivalentes({ energia_kcal: 70, equivalentes: { cereales: 1 } });

    expect(revision.coherente).toBe(true);
    expect(revision.motivo).toBeNull();
  });

  it('tolera la diferencia normal contra el promedio del grupo', () => {
    // 80 kcal contra las 70 del equivalente promedio: 14 %, dentro del margen.
    expect(
      verificarEquivalentes({ energia_kcal: 80, equivalentes: { cereales: 1 } }).coherente,
    ).toBe(true);
  });

  it('rechaza el equivalente mal asignado y explica por qué', () => {
    const revision = verificarEquivalentes({ energia_kcal: 250, equivalentes: { cereales: 1 } });

    expect(revision.coherente).toBe(false);
    expect(revision.motivo).toMatch(/70 kcal/);
    expect(revision.desviacion).toBeGreaterThan(0.25);
  });

  it('rechaza un alimento con energía que no declara ningún equivalente', () => {
    const revision = verificarEquivalentes({ energia_kcal: 150, equivalentes: {} });

    expect(revision.coherente).toBe(false);
    expect(revision.motivo).toMatch(/no declara/);
  });

  it('acepta sin equivalentes un alimento libre de energía', () => {
    expect(verificarEquivalentes({ energia_kcal: 4, equivalentes: {} }).coherente).toBe(true);
  });

  it('trata los equivalentes en cero como ausentes', () => {
    expect(verificarEquivalentes({ energia_kcal: 2, equivalentes: { verduras: 0 } }).coherente).toBe(
      true,
    );
  });

  it('acepta la verdura de baja densidad que igual cuenta como un equivalente', () => {
    // Espinaca cruda: 14 kcal reales contra las 25 del equivalente promedio.
    // El 79 % de desviación relativa es real, pero son 11 kcal.
    const revision = verificarEquivalentes({ energia_kcal: 14, equivalentes: { verduras: 1 } });

    expect(revision.coherente).toBe(true);
  });

  it('el margen absoluto no tapa un error grande en un alimento chico', () => {
    expect(
      verificarEquivalentes({ energia_kcal: 30, equivalentes: { leguminosas: 1 } }).coherente,
    ).toBe(false);
  });

  it('permite endurecer la tolerancia para una revisión más estricta', () => {
    const alimento = { energia_kcal: 150, equivalentes: { leguminosas: 1 } };

    expect(verificarEquivalentes(alimento).coherente).toBe(true);
    expect(verificarEquivalentes(alimento, 0.05).coherente).toBe(false);
  });
});
