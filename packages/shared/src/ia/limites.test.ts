import {
  LIMITE_GENERACIONES_IA,
  LIMITE_INTERACCIONES_IA_PACIENTE,
  calcularCuota,
  calcularCuotaPaciente,
  mesDeUso,
} from './limites';

describe('mesDeUso', () => {
  it('devuelve el mes en formato YYYY-MM con dos dígitos', () => {
    expect(mesDeUso(new Date('2026-07-23T12:00:00Z'))).toBe('2026-07');
    expect(mesDeUso(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });

  it('usa UTC para que la clave no cambie según la zona horaria', () => {
    // 23:30 del 31 de julio en México sigue siendo agosto en UTC.
    expect(mesDeUso(new Date('2026-08-01T04:30:00Z'))).toBe('2026-08');
  });
});

describe('calcularCuota', () => {
  it('respeta el límite de cada plan', () => {
    expect(calcularCuota('FREE', 0).limite).toBe(LIMITE_GENERACIONES_IA.FREE);
    expect(calcularCuota('PRO', 0).limite).toBe(150);
    expect(calcularCuota('CLINICA', 0).limite).toBe(500);
  });

  it('calcula las generaciones restantes', () => {
    expect(calcularCuota('FREE', 4)).toMatchObject({ usadas: 4, restantes: 11, agotada: false });
  });

  it('marca la cuota agotada al llegar al límite', () => {
    expect(calcularCuota('FREE', 15)).toMatchObject({ restantes: 0, agotada: true });
  });

  it('nunca devuelve restantes negativas si el contador se pasó', () => {
    expect(calcularCuota('FREE', 40)).toMatchObject({ restantes: 0, agotada: true });
  });

  it('trata contadores inválidos como cero consumido', () => {
    expect(calcularCuota('PRO', -3).usadas).toBe(0);
    expect(calcularCuota('PRO', Number.NaN).usadas).toBe(0);
  });

  it('en modo beta no raciona: sin límite y nunca agotada', () => {
    expect(calcularCuota('FREE', 400, 'beta')).toMatchObject({
      limite: null,
      restantes: null,
      usadas: 400,
      agotada: false,
      ilimitada: true,
    });
  });

  it('vuelve a racionar en cuanto el modo es producción', () => {
    expect(calcularCuota('FREE', 400, 'produccion')).toMatchObject({
      limite: 15,
      agotada: true,
      ilimitada: false,
    });
  });
});

describe('calcularCuotaPaciente', () => {
  it('arranca con el tope completo disponible', () => {
    expect(calcularCuotaPaciente(0)).toEqual({
      limite: LIMITE_INTERACCIONES_IA_PACIENTE,
      usadas: 0,
      restantes: LIMITE_INTERACCIONES_IA_PACIENTE,
      agotada: false,
    });
  });

  it('descuenta cada interacción del tope', () => {
    expect(calcularCuotaPaciente(4)).toMatchObject({ usadas: 4, restantes: 26, agotada: false });
  });

  it('marca la cuota agotada al llegar al tope', () => {
    expect(calcularCuotaPaciente(LIMITE_INTERACCIONES_IA_PACIENTE)).toMatchObject({
      restantes: 0,
      agotada: true,
    });
  });

  it('nunca devuelve restantes negativas si el contador se pasó', () => {
    expect(calcularCuotaPaciente(120)).toMatchObject({ restantes: 0, agotada: true });
  });

  it('trata contadores inválidos como cero consumido', () => {
    expect(calcularCuotaPaciente(-5).usadas).toBe(0);
    expect(calcularCuotaPaciente(Number.NaN).usadas).toBe(0);
    expect(calcularCuotaPaciente(2.7).usadas).toBe(2);
  });

  it('admite un tope distinto sin tocar el default', () => {
    expect(calcularCuotaPaciente(3, 5)).toMatchObject({ limite: 5, restantes: 2 });
    expect(calcularCuotaPaciente(0).limite).toBe(LIMITE_INTERACCIONES_IA_PACIENTE);
  });

  it('no tiene modo beta: el tope sigue vigente aunque el de la clínica se suelte', () => {
    // La cuota de la clínica en beta es ilimitada; la del paciente, no. Es la
    // única defensa contra que un paciente dispare el gasto de la cuenta.
    expect(calcularCuota('FREE', 400, 'beta').ilimitada).toBe(true);
    expect(calcularCuotaPaciente(400).agotada).toBe(true);
  });
});
