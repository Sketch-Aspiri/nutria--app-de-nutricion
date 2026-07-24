import {
  diferenciaEnDias,
  esFechaIso,
  fechaIsoEnZona,
  fechaMaxima,
  fechaMinima,
  rangoDeDias,
  sumarDias,
} from './fechas';

describe('esFechaIso', () => {
  it('acepta una fecha civil bien formada', () => {
    expect(esFechaIso('2026-07-23')).toBe(true);
  });

  it('rechaza formatos que no son YYYY-MM-DD', () => {
    expect(esFechaIso('23/07/2026')).toBe(false);
    expect(esFechaIso('2026-7-3')).toBe(false);
    expect(esFechaIso('2026-07-23T10:00:00Z')).toBe(false);
    expect(esFechaIso(20260723)).toBe(false);
    expect(esFechaIso(null)).toBe(false);
  });

  it('rechaza un día que no existe en el calendario', () => {
    expect(esFechaIso('2026-02-30')).toBe(false);
  });
});

describe('fechaIsoEnZona', () => {
  it('usa el día civil de la zona indicada, no el del servidor', () => {
    // 03:00 UTC del día 24 son las 21:00 del día 23 en Ciudad de México.
    const instante = new Date('2026-07-24T03:00:00Z');

    expect(fechaIsoEnZona(instante, 'UTC')).toBe('2026-07-24');
    expect(fechaIsoEnZona(instante, 'America/Mexico_City')).toBe('2026-07-23');
  });
});

describe('sumarDias', () => {
  it('avanza y retrocede días', () => {
    expect(sumarDias('2026-07-23', 1)).toBe('2026-07-24');
    expect(sumarDias('2026-07-23', -1)).toBe('2026-07-22');
  });

  it('cruza el cambio de mes y de año', () => {
    expect(sumarDias('2026-07-31', 1)).toBe('2026-08-01');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('respeta el 29 de febrero de un año bisiesto', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('no se corre con el horario de verano', () => {
    // Si el cálculo pasara por la zona local, un día de 23 horas se comería
    // la medianoche y el resultado repetiría el día anterior.
    expect(sumarDias('2026-04-05', 1)).toBe('2026-04-06');
    expect(sumarDias('2026-10-25', 1)).toBe('2026-10-26');
  });
});

describe('diferenciaEnDias', () => {
  it('cuenta días completos', () => {
    expect(diferenciaEnDias('2026-07-20', '2026-07-23')).toBe(3);
  });

  it('devuelve 0 para el mismo día y negativo si el rango se invierte', () => {
    expect(diferenciaEnDias('2026-07-23', '2026-07-23')).toBe(0);
    expect(diferenciaEnDias('2026-07-23', '2026-07-20')).toBe(-3);
  });
});

describe('rangoDeDias', () => {
  it('incluye ambos extremos', () => {
    expect(rangoDeDias('2026-07-21', '2026-07-23')).toEqual([
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
    ]);
  });

  it('devuelve un solo día cuando los extremos coinciden', () => {
    expect(rangoDeDias('2026-07-23', '2026-07-23')).toEqual(['2026-07-23']);
  });

  it('devuelve vacío si el rango está invertido', () => {
    expect(rangoDeDias('2026-07-23', '2026-07-21')).toEqual([]);
  });
});

describe('fechaMinima y fechaMaxima', () => {
  it('eligen el extremo correcto', () => {
    expect(fechaMinima('2026-07-23', '2026-07-01')).toBe('2026-07-01');
    expect(fechaMaxima('2026-07-23', '2026-07-01')).toBe('2026-07-23');
  });
});
