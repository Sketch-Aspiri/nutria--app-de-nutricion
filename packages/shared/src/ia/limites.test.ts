import { LIMITE_GENERACIONES_IA, calcularCuota, mesDeUso } from './limites';

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
