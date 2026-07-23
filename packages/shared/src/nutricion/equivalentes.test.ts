import {
  EQUIVALENTE_SMAE,
  GRUPOS_SMAE,
  MINIMOS_POR_DEFECTO,
  distribuirEquivalentes,
} from './equivalentes';
import type { MetaMacros } from './equivalentes';

/** Meta típica de un plan de pérdida de grasa: 1800 kcal, 30/40/30. */
const meta: MetaMacros = { kcal: 1800, proteina_g: 135, carbos_g: 180, grasa_g: 60 };

function renglon(distribucion: ReturnType<typeof distribuirEquivalentes>, grupo: string) {
  const encontrado = distribucion.renglones.find((r) => r.grupo === grupo);
  if (!encontrado) throw new Error(`Falta el grupo ${grupo} en la distribución`);
  return encontrado;
}

describe('distribuirEquivalentes', () => {
  it('devuelve un renglón por grupo SMAE, siempre en el mismo orden', () => {
    const resultado = distribuirEquivalentes(meta);

    expect(resultado.renglones.map((r) => r.grupo)).toEqual(GRUPOS_SMAE);
  });

  it('respeta los mínimos de verduras, frutas, leguminosas y leche', () => {
    const resultado = distribuirEquivalentes(meta);

    expect(renglon(resultado, 'verduras').equivalentes).toBe(MINIMOS_POR_DEFECTO.verduras);
    expect(renglon(resultado, 'frutas').equivalentes).toBe(MINIMOS_POR_DEFECTO.frutas);
    expect(renglon(resultado, 'leguminosas').equivalentes).toBe(MINIMOS_POR_DEFECTO.leguminosas);
    expect(renglon(resultado, 'leche').equivalentes).toBe(MINIMOS_POR_DEFECTO.leche);
  });

  it('cubre los hidratos restantes con cereales', () => {
    const resultado = distribuirEquivalentes(meta);
    // Base: 3 verduras (12) + 3 frutas (45) + 1 leguminosa (20) + 2 leche (24) = 101 g HC.
    // Faltan 79 g → 79/15 = 5.27 → 5.5 equivalentes.
    expect(renglon(resultado, 'cereales').equivalentes).toBe(5.5);
  });

  it('cubre la proteína restante con alimentos de origen animal', () => {
    const resultado = distribuirEquivalentes(meta);
    const aoa = renglon(resultado, 'origen_animal');

    expect(aoa.equivalentes).toBeGreaterThan(0);
    expect(resultado.totales.proteina_g).toBeGreaterThanOrEqual(meta.proteina_g - 7);
  });

  it('reparte en medios equivalentes, como se receta en consulta', () => {
    const resultado = distribuirEquivalentes(meta);

    for (const fila of resultado.renglones) {
      expect((fila.equivalentes * 2) % 1).toBe(0);
    }
  });

  it('queda dentro del 5 % de las calorías objetivo en una meta típica', () => {
    const resultado = distribuirEquivalentes(meta);

    expect(Math.abs(resultado.desviacion.kcalPct)).toBeLessThanOrEqual(5);
    expect(resultado.advertencias).toHaveLength(0);
  });

  it.each([
    [1400, 105, 140, 47],
    [1800, 135, 180, 60],
    [2200, 165, 220, 73],
    [2600, 195, 260, 87],
  ])('mantiene la desviación acotada en una meta de %s kcal', (kcal, prot, carb, gras) => {
    const resultado = distribuirEquivalentes({
      kcal,
      proteina_g: prot,
      carbos_g: carb,
      grasa_g: gras,
    });

    expect(Math.abs(resultado.desviacion.kcalPct)).toBeLessThanOrEqual(8);
  });

  it('los totales son la suma de los renglones', () => {
    const resultado = distribuirEquivalentes(meta);
    const sumaKcal = resultado.renglones.reduce((total, fila) => total + fila.kcal, 0);

    expect(resultado.totales.kcal).toBeCloseTo(sumaKcal, 0);
  });

  it('permite subir los mínimos por grupo', () => {
    const resultado = distribuirEquivalentes(meta, { minimos: { verduras: 6 } });

    expect(renglon(resultado, 'verduras').equivalentes).toBe(6);
  });

  it('no resta de los mínimos cuando ya cubren un macro: lo reporta', () => {
    // Meta muy baja en hidratos: los mínimos de fruta y leche ya la exceden.
    const resultado = distribuirEquivalentes({
      kcal: 1200,
      proteina_g: 120,
      carbos_g: 40,
      grasa_g: 50,
    });

    expect(renglon(resultado, 'cereales').equivalentes).toBe(0);
    expect(renglon(resultado, 'frutas').equivalentes).toBe(MINIMOS_POR_DEFECTO.frutas);
    expect(resultado.advertencias.join(' ')).toMatch(/hidratos/i);
    expect(resultado.desviacion.carbos_g).toBeGreaterThan(0);
  });

  it('rechaza una meta sin calorías', () => {
    expect(() => distribuirEquivalentes({ ...meta, kcal: 0 })).toThrow('EXPEDIENTE_INCOMPLETO');
  });
});

describe('EQUIVALENTE_SMAE', () => {
  it('el aporte energético de cada grupo es coherente con sus macros', () => {
    for (const grupo of GRUPOS_SMAE) {
      const { kcal, proteina, hidratos, lipidos } = EQUIVALENTE_SMAE[grupo];
      const calculadas = proteina * 4 + hidratos * 4 + lipidos * 9;
      // El SMAE redondea las kcal publicadas; se admite ese margen.
      expect(Math.abs(calculadas - kcal)).toBeLessThanOrEqual(10);
    }
  });
});
