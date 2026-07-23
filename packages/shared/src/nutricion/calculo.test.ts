import { calcularTDEE } from './calculo';
import type { DatosCalculo } from './calculo';
import { AJUSTE_OBJETIVO, FACTOR_ACTIVIDAD, bmrHarrisBenedict } from './energia';

const base: DatosCalculo = {
  peso: 68,
  altura: 165,
  edad: 29,
  genero: 'Femenino',
  nivelActividad: 'Moderado',
  objetivo: 'Pérdida de grasa',
};

/** Paciente con obesidad, para los casos de peso ajustado. */
const conObesidad: DatosCalculo = { ...base, peso: 98, objetivo: 'Pérdida de grasa' };

describe('calcularTDEE', () => {
  it('usa Mifflin-St Jeor cuando no se elige ecuación', () => {
    const resultado = calcularTDEE(base);

    expect(resultado.ecuacion).toBe('mifflin_st_jeor');
    expect(resultado.bmr).toBe(1405);
  });

  it('calcula con la ecuación elegida', () => {
    const resultado = calcularTDEE({ ...base, ecuacion: 'harris_benedict' });

    expect(resultado.ecuacion).toBe('harris_benedict');
    expect(resultado.bmr).toBe(bmrHarrisBenedict(base));
  });

  it('multiplica el BMR por el factor de actividad', () => {
    const resultado = calcularTDEE(base);

    expect(resultado.factorActividad).toBe(FACTOR_ACTIVIDAD.Moderado);
    expect(resultado.tdee).toBe(Math.round(resultado.bmr * FACTOR_ACTIVIDAD.Moderado));
  });

  it('aplica el ajuste del objetivo a las calorías meta', () => {
    const resultado = calcularTDEE(base);

    expect(resultado.ajusteObjetivo).toBe(AJUSTE_OBJETIVO['Pérdida de grasa']);
    expect(resultado.objetivoCalorias).toBe(
      Math.round(resultado.tdee * (1 + AJUSTE_OBJETIVO['Pérdida de grasa'])),
    );
    expect(resultado.objetivoCalorias).toBeLessThan(resultado.tdee);
  });

  it('mantenimiento deja las calorías en el TDEE', () => {
    const resultado = calcularTDEE({ ...base, objetivo: 'Mantenimiento' });

    expect(resultado.objetivoCalorias).toBe(resultado.tdee);
  });

  it('los gramos de macros equivalen a las calorías objetivo', () => {
    const resultado = calcularTDEE(base);
    const kcal = resultado.proteina_g * 4 + resultado.carbos_g * 4 + resultado.grasa_g * 9;

    expect(Math.abs(kcal - resultado.objetivoCalorias)).toBeLessThanOrEqual(12);
  });

  it('rechaza expedientes incompletos', () => {
    expect(() => calcularTDEE({ ...base, peso: 0 })).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() => calcularTDEE({ ...base, altura: -1 })).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() => calcularTDEE({ ...base, edad: 0 })).toThrow('EXPEDIENTE_INCOMPLETO');
  });

  it('exige % de grasa para Katch-McArdle', () => {
    expect(() => calcularTDEE({ ...base, ecuacion: 'katch_mcardle' })).toThrow(
      'EXPEDIENTE_INCOMPLETO',
    );
    expect(calcularTDEE({ ...base, ecuacion: 'katch_mcardle', grasaPct: 28 }).bmr).toBe(1428);
  });

  describe('peso ajustado', () => {
    it('no se aplica solo, aunque el IMC lo sugiera', () => {
      const resultado = calcularTDEE(conObesidad);

      expect(resultado.pesoAjustadoAplicado).toBe(false);
      expect(resultado.pesoUsado).toBe(conObesidad.peso);
    });

    it('baja el requerimiento cuando el nutriólogo lo pide', () => {
      const real = calcularTDEE(conObesidad);
      const ajustado = calcularTDEE({ ...conObesidad, usarPesoAjustado: true });

      expect(ajustado.pesoAjustadoAplicado).toBe(true);
      expect(ajustado.pesoUsado).toBeLessThan(conObesidad.peso);
      expect(ajustado.objetivoCalorias).toBeLessThan(real.objetivoCalorias);
    });

    it('avisa si se aplica sin obesidad', () => {
      const resultado = calcularTDEE({ ...base, usarPesoAjustado: true });

      expect(resultado.advertencias.join(' ')).toMatch(/peso ajustado/i);
    });

    it('Katch-McArdle sigue usando el peso real: la masa magra ya lo descuenta', () => {
      const conAjuste = calcularTDEE({
        ...conObesidad,
        ecuacion: 'katch_mcardle',
        grasaPct: 40,
        usarPesoAjustado: true,
      });
      const sinAjuste = calcularTDEE({ ...conObesidad, ecuacion: 'katch_mcardle', grasaPct: 40 });

      expect(conAjuste.bmr).toBe(sinAjuste.bmr);
      expect(conAjuste.advertencias.join(' ')).toMatch(/Katch/i);
    });
  });

  describe('modo de proteína', () => {
    it('por defecto reparte la proteína como porcentaje de las calorías', () => {
      const resultado = calcularTDEE(base);

      expect(resultado.pPct).toBeGreaterThanOrEqual(29);
      expect(resultado.pPct).toBeLessThanOrEqual(31);
    });

    it('en g/kg fija la proteína sobre el peso y reparte el resto', () => {
      const resultado = calcularTDEE({
        ...base,
        modoProteina: 'g_por_kg',
        proteinaGPorKg: 1.6,
      });

      expect(resultado.proteina_g).toBe(Math.round(1.6 * base.peso));
      expect(resultado.proteinaGPorKg).toBeCloseTo(1.6, 1);
      const kcal = resultado.proteina_g * 4 + resultado.carbos_g * 4 + resultado.grasa_g * 9;
      expect(Math.abs(kcal - resultado.objetivoCalorias)).toBeLessThanOrEqual(12);
    });

    it('respeta el tope renal aunque el objetivo pida más proteína', () => {
      const resultado = calcularTDEE({
        ...base,
        objetivo: 'Ganancia muscular',
        modoProteina: 'g_por_kg',
        proteinaGPorKg: 2,
        condiciones: ['Enfermedad renal'],
      });

      expect(resultado.proteinaGPorKg).toBeLessThanOrEqual(0.8);
      expect(resultado.advertencias.join(' ')).toMatch(/renal/i);
    });

    it('avisa cuando el porcentaje fijo se pasa del máximo clínico en g/kg', () => {
      // Paciente ligero con objetivo deportivo: el 30 % de kcal supera 2.0 g/kg.
      const resultado = calcularTDEE({
        ...base,
        peso: 45,
        altura: 150,
        objetivo: 'Mejora deportiva',
        nivelActividad: 'Muy activo',
      });

      expect(resultado.advertencias.join(' ')).toMatch(/g\/kg/);
    });
  });

  it('incluye el requerimiento de agua del paciente', () => {
    const resultado = calcularTDEE(base);

    expect(resultado.aguaMl).toBe(35 * base.peso);
  });
});
