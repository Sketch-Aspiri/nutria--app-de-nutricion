import { esAdherenciaBaja, totalCaloriasPlan, UMBRAL_ADHERENCIA_BAJA } from './adherencia';

describe('esAdherenciaBaja', () => {
  it('marca como baja una adherencia por debajo del umbral', () => {
    expect(esAdherenciaBaja(UMBRAL_ADHERENCIA_BAJA - 1)).toBe(true);
  });

  it('no marca como baja una adherencia igual o mayor al umbral', () => {
    expect(esAdherenciaBaja(UMBRAL_ADHERENCIA_BAJA)).toBe(false);
    expect(esAdherenciaBaja(100)).toBe(false);
  });
});

describe('totalCaloriasPlan', () => {
  it('suma las calorías de todas las comidas', () => {
    expect(totalCaloriasPlan([{ calorias: 300 }, { calorias: 450 }, { calorias: 250 }])).toBe(1000);
  });

  it('devuelve 0 para un plan sin comidas', () => {
    expect(totalCaloriasPlan([])).toBe(0);
  });

  it('ignora valores no numéricos sin romper la suma', () => {
    expect(totalCaloriasPlan([{ calorias: 300 }, { calorias: Number.NaN }])).toBe(300);
  });
});
