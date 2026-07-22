import { AJUSTE_OBJETIVO, calcularTDEE, distribucionMacros, FACTOR_ACTIVIDAD } from './nutricion';
import type { DatosCalculo } from './nutricion';

const base: DatosCalculo = {
  peso: 68,
  altura: 165,
  edad: 29,
  genero: 'Femenino',
  nivelActividad: 'Moderado',
  objetivo: 'Pérdida de grasa',
};

describe('calcularTDEE', () => {
  it('calcula BMR femenino con Mifflin-St Jeor', () => {
    const r = calcularTDEE(base);
    // 10*68 + 6.25*165 - 5*29 - 161 = 1405.25 → 1405
    expect(r.bmr).toBe(1405);
  });

  it('calcula BMR masculino con el ajuste +5', () => {
    const r = calcularTDEE({ ...base, genero: 'Masculino' });
    expect(r.bmr).toBe(1571);
  });

  it('usa la fórmula femenina para género "Otro"', () => {
    const otro = calcularTDEE({ ...base, genero: 'Otro' });
    const fem = calcularTDEE(base);
    expect(otro.bmr).toBe(fem.bmr);
  });

  it('multiplica el BMR por el factor de actividad', () => {
    const r = calcularTDEE(base);
    expect(r.tdee).toBe(Math.round(r.bmr * FACTOR_ACTIVIDAD.Moderado));
  });

  it('aplica déficit del 20% para pérdida de grasa', () => {
    const r = calcularTDEE(base);
    expect(r.objetivoCalorias).toBe(Math.round(r.tdee * (1 + AJUSTE_OBJETIVO['Pérdida de grasa'])));
    expect(r.objetivoCalorias).toBeLessThan(r.tdee);
  });

  it('aplica superávit del 10% para ganancia muscular', () => {
    const r = calcularTDEE({ ...base, objetivo: 'Ganancia muscular' });
    expect(r.objetivoCalorias).toBe(Math.round(r.tdee * 1.1));
  });

  it('mantenimiento no ajusta las calorías', () => {
    const r = calcularTDEE({ ...base, objetivo: 'Mantenimiento' });
    expect(r.objetivoCalorias).toBe(r.tdee);
  });

  it('los gramos de macros equivalen aproximadamente a las calorías objetivo', () => {
    const r = calcularTDEE(base);
    const kcal = r.proteina_g * 4 + r.carbos_g * 4 + r.grasa_g * 9;
    // tolerancia por redondeo de gramos
    expect(Math.abs(kcal - r.objetivoCalorias)).toBeLessThanOrEqual(12);
  });

  it('rechaza expedientes incompletos (peso, altura o edad no positivos)', () => {
    expect(() => calcularTDEE({ ...base, peso: 0 })).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() => calcularTDEE({ ...base, altura: -1 })).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() => calcularTDEE({ ...base, edad: 0 })).toThrow('EXPEDIENTE_INCOMPLETO');
  });
});

describe('distribucionMacros', () => {
  it.each(['Pérdida de grasa', 'Ganancia muscular', 'Control de diabetes', 'Mantenimiento'] as const)(
    'la distribución para "%s" suma 100%%',
    (objetivo) => {
      const { pPct, cPct, gPct } = distribucionMacros(objetivo);
      expect(pPct + cPct + gPct).toBeCloseTo(1);
    },
  );

  it('sube carbohidratos para objetivos deportivos', () => {
    expect(distribucionMacros('Ganancia muscular').cPct).toBe(0.45);
    expect(distribucionMacros('Mejora deportiva').cPct).toBe(0.45);
  });

  it('reduce carbohidratos para control de diabetes', () => {
    expect(distribucionMacros('Control de diabetes').cPct).toBe(0.35);
  });
});
