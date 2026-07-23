import {
  PROTEINA_G_POR_KG_MAX,
  TOPE_PROTEINA_RENAL,
  distribucionMacros,
  requerimientoAgua,
  requerimientoProteina,
} from './requerimientos';

describe('distribucionMacros', () => {
  it.each([
    'Pérdida de grasa',
    'Ganancia muscular',
    'Control de diabetes',
    'Mantenimiento',
  ] as const)('la distribución para "%s" suma 100%%', (objetivo) => {
    const { pPct, cPct, gPct } = distribucionMacros(objetivo);
    expect(pPct + cPct + gPct).toBeCloseTo(1);
  });

  it('sube carbohidratos para objetivos deportivos', () => {
    expect(distribucionMacros('Ganancia muscular').cPct).toBe(0.45);
    expect(distribucionMacros('Mejora deportiva').cPct).toBe(0.45);
  });

  it('reduce carbohidratos para control de diabetes', () => {
    expect(distribucionMacros('Control de diabetes').cPct).toBe(0.35);
  });
});

describe('requerimientoProteina', () => {
  it('usa el rango alto para ganancia muscular', () => {
    const resultado = requerimientoProteina({ pesoKg: 70, objetivo: 'Ganancia muscular' });

    expect(resultado.gPorKgSugerido).toBe(1.8);
    expect(resultado.gramos).toBe(126);
  });

  it('usa un rango conservador para mantenimiento', () => {
    const resultado = requerimientoProteina({ pesoKg: 70, objetivo: 'Mantenimiento' });

    expect(resultado.gPorKgSugerido).toBe(1);
    expect(resultado.gramos).toBe(70);
  });

  it('respeta los g/kg que elige el nutriólogo dentro del rango', () => {
    const resultado = requerimientoProteina({
      pesoKg: 70,
      objetivo: 'Pérdida de grasa',
      gPorKg: 1.7,
    });

    expect(resultado.gramos).toBe(119);
    expect(resultado.advertencias).toHaveLength(0);
  });

  it('limita a 0.8 g/kg con enfermedad renal en el expediente', () => {
    const resultado = requerimientoProteina({
      pesoKg: 70,
      objetivo: 'Ganancia muscular',
      condiciones: ['Enfermedad renal'],
    });

    expect(resultado.gPorKgSugerido).toBe(TOPE_PROTEINA_RENAL);
    expect(resultado.gramos).toBe(56);
    expect(resultado.limitadoPorCondicion).toBe(true);
    expect(resultado.advertencias.join(' ')).toMatch(/renal/i);
  });

  it('no deja que un valor manual rebase el tope renal, y lo avisa', () => {
    const resultado = requerimientoProteina({
      pesoKg: 70,
      objetivo: 'Mantenimiento',
      condiciones: ['Enfermedad renal'],
      gPorKg: 2,
    });

    expect(resultado.gramos).toBe(56);
    expect(resultado.advertencias.length).toBeGreaterThan(0);
  });

  it('recorta cualquier valor por encima del tope clínico del módulo', () => {
    const resultado = requerimientoProteina({
      pesoKg: 70,
      objetivo: 'Ganancia muscular',
      gPorKg: PROTEINA_G_POR_KG_MAX + 1,
    });

    expect(resultado.gramos).toBeLessThanOrEqual(Math.round(PROTEINA_G_POR_KG_MAX * 70));
    expect(resultado.advertencias.length).toBeGreaterThan(0);
  });

  it('rechaza un peso faltante', () => {
    expect(() => requerimientoProteina({ pesoKg: 0, objetivo: 'Mantenimiento' })).toThrow(
      'EXPEDIENTE_INCOMPLETO',
    );
  });
});

describe('requerimientoAgua', () => {
  it('usa 35 ml/kg antes de los 55 años', () => {
    const resultado = requerimientoAgua({ pesoKg: 68, edad: 29, nivelActividad: 'Moderado' });

    expect(resultado.mlPorKg).toBe(35);
    expect(resultado.ml).toBe(2380);
    expect(resultado.litros).toBe(2.4);
  });

  it('baja a 30 ml/kg a partir de los 55 años', () => {
    const resultado = requerimientoAgua({ pesoKg: 68, edad: 60, nivelActividad: 'Moderado' });

    expect(resultado.mlPorKg).toBe(30);
    expect(resultado.ml).toBe(2040);
  });

  it('suma 500 ml cuando la actividad es alta', () => {
    const moderado = requerimientoAgua({ pesoKg: 68, edad: 29, nivelActividad: 'Moderado' });
    const activo = requerimientoAgua({ pesoKg: 68, edad: 29, nivelActividad: 'Muy activo' });

    expect(activo.ml - moderado.ml).toBe(500);
    expect(activo.extraPorActividadMl).toBe(500);
  });

  it('rechaza expedientes sin peso o sin edad', () => {
    expect(() =>
      requerimientoAgua({ pesoKg: 0, edad: 29, nivelActividad: 'Moderado' }),
    ).toThrow('EXPEDIENTE_INCOMPLETO');
    expect(() =>
      requerimientoAgua({ pesoKg: 68, edad: 0, nivelActividad: 'Moderado' }),
    ).toThrow('EXPEDIENTE_INCOMPLETO');
  });
});
