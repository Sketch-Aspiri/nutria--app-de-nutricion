import {
  calcularAdherencia,
  calcularRacha,
  desgloseDiario,
  esAdherenciaBaja,
  tendenciaPeso,
  totalCaloriasPlan,
  UMBRAL_ADHERENCIA_BAJA,
} from './adherencia';

const HOY = '2026-07-23';

/** Un registro por cada comida indicada, en el día dado. */
function registros(fecha: string, cuantas: number) {
  return Array.from({ length: cuantas }, () => ({ fecha }));
}

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

describe('calcularRacha', () => {
  it('cuenta días consecutivos hacia atrás desde hoy', () => {
    expect(calcularRacha(['2026-07-23', '2026-07-22', '2026-07-21'], HOY)).toBe(3);
  });

  it('no rompe la racha porque el día en curso aún no tenga registro', () => {
    expect(calcularRacha(['2026-07-22', '2026-07-21'], HOY)).toBe(2);
  });

  it('se corta en el primer día sin registro', () => {
    expect(calcularRacha(['2026-07-23', '2026-07-21', '2026-07-20'], HOY)).toBe(1);
  });

  it('cuenta un solo día aunque tenga varios registros', () => {
    expect(calcularRacha(['2026-07-23', '2026-07-23', '2026-07-23'], HOY)).toBe(1);
  });

  it('devuelve 0 sin registros y 0 si el último es de hace más de un día', () => {
    expect(calcularRacha([], HOY)).toBe(0);
    expect(calcularRacha(['2026-07-20'], HOY)).toBe(0);
  });
});

describe('calcularAdherencia', () => {
  const base = { comidasPorDia: 3, planActivoDesde: '2026-01-01', hoy: HOY };

  it('devuelve 100% cuando el paciente registra todas sus comidas', () => {
    const semanaCompleta = [
      ...registros('2026-07-17', 3),
      ...registros('2026-07-18', 3),
      ...registros('2026-07-19', 3),
      ...registros('2026-07-20', 3),
      ...registros('2026-07-21', 3),
      ...registros('2026-07-22', 3),
      ...registros('2026-07-23', 3),
    ];

    const resumen = calcularAdherencia({ ...base, registros: semanaCompleta });

    expect(resumen.adherencia).toBe(100);
    expect(resumen.comidasEsperadas).toBe(21);
    expect(resumen.comidasRegistradas).toBe(21);
    expect(resumen.diasEvaluados).toBe(7);
    expect(resumen.racha).toBe(7);
  });

  it('reparte proporcionalmente los registros parciales', () => {
    // 7 de 21 comidas esperadas = 33 %.
    const resumen = calcularAdherencia({
      ...base,
      registros: [
        ...registros('2026-07-23', 3),
        ...registros('2026-07-22', 3),
        ...registros('2026-07-21', 1),
      ],
    });

    expect(resumen.comidasRegistradas).toBe(7);
    expect(resumen.adherencia).toBe(33);
    expect(resumen.diasConRegistro).toBe(3);
  });

  it('no deja que un día con exceso de registros tape los días vacíos', () => {
    // Diez registros el mismo día siguen valiendo, como mucho, un día completo.
    const resumen = calcularAdherencia({ ...base, registros: registros(HOY, 10) });

    expect(resumen.comidasRegistradas).toBe(3);
    expect(resumen.adherencia).toBe(14);
  });

  it('ignora registros anteriores a la ventana evaluada', () => {
    const resumen = calcularAdherencia({
      ...base,
      registros: [...registros('2026-07-01', 3), ...registros(HOY, 3)],
    });

    expect(resumen.comidasRegistradas).toBe(3);
  });

  it('solo evalúa desde que el plan está activo', () => {
    // El plan se activó anteayer: no se le reclaman al paciente los días previos.
    const resumen = calcularAdherencia({
      ...base,
      planActivoDesde: '2026-07-21',
      registros: [
        ...registros('2026-07-21', 3),
        ...registros('2026-07-22', 3),
        ...registros('2026-07-23', 3),
      ],
    });

    expect(resumen.diasEvaluados).toBe(3);
    expect(resumen.comidasEsperadas).toBe(9);
    expect(resumen.adherencia).toBe(100);
  });

  it('evalúa un solo día cuando el plan se activó hoy', () => {
    const resumen = calcularAdherencia({ ...base, planActivoDesde: HOY, registros: [] });

    expect(resumen.diasEvaluados).toBe(1);
    expect(resumen.desde).toBe(HOY);
    expect(resumen.adherencia).toBe(0);
  });

  it('trata un plan activado en el futuro como si empezara hoy, sin dividir entre cero', () => {
    const resumen = calcularAdherencia({ ...base, planActivoDesde: '2026-08-01', registros: [] });

    expect(resumen.diasEvaluados).toBe(1);
    expect(resumen.comidasEsperadas).toBe(3);
    expect(Number.isFinite(resumen.adherencia)).toBe(true);
  });

  it('devuelve 0 % sin registros, no NaN', () => {
    const resumen = calcularAdherencia({ ...base, registros: [] });

    expect(resumen.adherencia).toBe(0);
    expect(resumen.racha).toBe(0);
  });

  it('acepta ventanas distintas a la semana', () => {
    const resumen = calcularAdherencia({ ...base, dias: 30, registros: [] });

    expect(resumen.diasEvaluados).toBe(30);
    expect(resumen.comidasEsperadas).toBe(90);
  });
});

describe('desgloseDiario', () => {
  it('incluye los días sin registro para que el hueco se vea', () => {
    const dias = desgloseDiario({
      comidasPorDia: 3,
      planActivoDesde: '2026-07-21',
      hoy: HOY,
      registros: registros('2026-07-23', 2),
    });

    expect(dias).toEqual([
      { fecha: '2026-07-21', registradas: 0, esperadas: 3 },
      { fecha: '2026-07-22', registradas: 0, esperadas: 3 },
      { fecha: '2026-07-23', registradas: 2, esperadas: 3 },
    ]);
  });
});

describe('tendenciaPeso', () => {
  it('compara el primer y el último registro por fecha, no por orden de llegada', () => {
    expect(
      tendenciaPeso([
        { fecha: '2026-07-23', pesoKg: 78.2 },
        { fecha: '2026-07-01', pesoKg: 80.5 },
      ]),
    ).toEqual({ inicial: 80.5, actual: 78.2, cambioKg: -2.3 });
  });

  it('redondea a una décima en vez de arrastrar el error de coma flotante', () => {
    const tendencia = tendenciaPeso([
      { fecha: '2026-07-01', pesoKg: 80.1 },
      { fecha: '2026-07-23', pesoKg: 79.8 },
    ]);

    expect(tendencia?.cambioKg).toBe(-0.3);
  });

  it('devuelve null sin registros', () => {
    expect(tendenciaPeso([])).toBeNull();
  });
});
