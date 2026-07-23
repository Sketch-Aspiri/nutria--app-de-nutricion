import {
  AJUSTE_OBJETIVO,
  FACTOR_ACTIVIDAD,
  bmrFaoOms,
  bmrHarrisBenedict,
  bmrKatchMcArdle,
  bmrMifflinStJeor,
  calcularBmr,
  compararEcuaciones,
} from './energia';
import type { DatosBmr } from './energia';

const mujer: DatosBmr = { peso: 68, altura: 165, edad: 29, genero: 'Femenino' };
const hombre: DatosBmr = { peso: 80, altura: 178, edad: 35, genero: 'Masculino' };

describe('bmrMifflinStJeor', () => {
  it('calcula el BMR femenino restando 161', () => {
    // 10*68 + 6.25*165 - 5*29 - 161 = 1405.25
    expect(bmrMifflinStJeor(mujer)).toBe(1405);
  });

  it('calcula el BMR masculino sumando 5', () => {
    // 10*80 + 6.25*178 - 5*35 + 5 = 1742.5
    expect(bmrMifflinStJeor(hombre)).toBe(1743);
  });

  it('trata el género "Otro" como femenino, que es la estimación conservadora', () => {
    expect(bmrMifflinStJeor({ ...mujer, genero: 'Otro' })).toBe(bmrMifflinStJeor(mujer));
  });

  it('rechaza expedientes sin peso, altura o edad', () => {
    expect(() => bmrMifflinStJeor({ ...mujer, peso: 0 })).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() => bmrMifflinStJeor({ ...mujer, altura: -1 })).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() => bmrMifflinStJeor({ ...mujer, edad: 0 })).toThrow('EXPEDIENTE_INCOMPLETO');
  });
});

describe('bmrHarrisBenedict', () => {
  it('usa los coeficientes revisados de Roza-Shizgal para mujer', () => {
    // 447.593 + 9.247*68 + 3.098*165 - 4.330*29 = 1461.99
    expect(bmrHarrisBenedict(mujer)).toBe(1462);
  });

  it('usa los coeficientes revisados de Roza-Shizgal para hombre', () => {
    // 88.362 + 13.397*80 + 4.799*178 - 5.677*35 = 1815.9
    expect(bmrHarrisBenedict(hombre)).toBe(1816);
  });

  it('estima por encima de Mifflin-St Jeor, como es sabido de la ecuación', () => {
    expect(bmrHarrisBenedict(mujer)).toBeGreaterThan(bmrMifflinStJeor(mujer));
  });
});

describe('bmrFaoOms', () => {
  it('aplica el tramo 18-30 en mujer de 29 años', () => {
    // 14.7*68 + 496 = 1495.6
    expect(bmrFaoOms(mujer)).toBe(1496);
  });

  it('aplica el tramo 30-60 en hombre de 35 años', () => {
    // 11.6*80 + 879 = 1807
    expect(bmrFaoOms(hombre)).toBe(1807);
  });

  it('cambia de tramo al cruzar los 30 años', () => {
    const antes = bmrFaoOms({ ...mujer, edad: 30 });
    const despues = bmrFaoOms({ ...mujer, edad: 31 });
    expect(antes).not.toBe(despues);
  });

  it('no depende de la altura: solo del peso, la edad y el sexo', () => {
    expect(bmrFaoOms({ ...mujer, altura: 190 })).toBe(bmrFaoOms(mujer));
  });
});

describe('bmrKatchMcArdle', () => {
  it('calcula sobre la masa magra', () => {
    // magra = 68 * 0.72 = 48.96 → 370 + 21.6*48.96 = 1427.5
    expect(bmrKatchMcArdle({ ...mujer, grasaPct: 28 })).toBe(1428);
  });

  it('exige % de grasa: sin ese dato el expediente está incompleto', () => {
    expect(() => bmrKatchMcArdle(mujer)).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() => bmrKatchMcArdle({ ...mujer, grasaPct: 0 })).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() => bmrKatchMcArdle({ ...mujer, grasaPct: 100 })).toThrow('EXPEDIENTE_INCOMPLETO');
  });
});

describe('calcularBmr', () => {
  it('despacha a la ecuación pedida', () => {
    expect(calcularBmr('harris_benedict', mujer)).toBe(bmrHarrisBenedict(mujer));
    expect(calcularBmr('fao_oms', mujer)).toBe(bmrFaoOms(mujer));
  });
});

describe('compararEcuaciones', () => {
  it('devuelve las cuatro ecuaciones con su TDEE', () => {
    const filas = compararEcuaciones({ ...mujer, grasaPct: 28 }, 'Moderado');

    expect(filas).toHaveLength(4);
    for (const fila of filas) {
      expect(fila.disponible).toBe(true);
      if (fila.disponible) {
        expect(fila.tdee).toBe(Math.round(fila.bmr * FACTOR_ACTIVIDAD.Moderado));
      }
    }
  });

  it('marca Katch-McArdle como no disponible sin % de grasa, en vez de omitirla', () => {
    const filas = compararEcuaciones(mujer, 'Moderado');
    const katch = filas.find((f) => f.ecuacion === 'katch_mcardle');

    expect(katch?.disponible).toBe(false);
    if (katch && !katch.disponible) {
      expect(katch.motivo).toMatch(/grasa/i);
    }
  });

  it('marca todas como no disponibles cuando el expediente no tiene medidas', () => {
    const filas = compararEcuaciones({ ...mujer, peso: 0 }, 'Moderado');
    expect(filas.every((f) => !f.disponible)).toBe(true);
  });
});

describe('AJUSTE_OBJETIVO', () => {
  it('aplica déficit para pérdida de grasa y superávit para ganancia muscular', () => {
    expect(AJUSTE_OBJETIVO['Pérdida de grasa']).toBeLessThan(0);
    expect(AJUSTE_OBJETIVO['Ganancia muscular']).toBeGreaterThan(0);
    expect(AJUSTE_OBJETIVO.Mantenimiento).toBe(0);
  });
});
