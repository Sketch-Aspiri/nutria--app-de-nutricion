import {
  calcularEstadoCuenta,
  calcularExpiracionInicial,
  calcularNuevaExpiracionAlActivar,
} from './activacion';

describe('activación mensual de cuentas', () => {
  it('mantiene activa una cuenta antes de su fecha de expiración', () => {
    const ahora = new Date('2026-08-04T12:00:00.000Z');
    const expiracion = new Date('2026-08-04T12:00:00.001Z');

    expect(calcularEstadoCuenta(expiracion, ahora)).toBe('ACTIVA');
  });

  it('bloquea en la frontera exacta de expiración', () => {
    const frontera = new Date('2026-09-04T12:00:00.000Z');

    expect(calcularEstadoCuenta(frontera, frontera)).toBe('BLOQUEADA');
  });

  it('bloquea una cuenta cuyo acceso ya venció', () => {
    expect(
      calcularEstadoCuenta(
        new Date('2026-07-01T00:00:00.000Z'),
        new Date('2026-08-04T00:00:00.000Z'),
      ),
    ).toBe('BLOQUEADA');
  });

  it('calcula el primer mes desde la fecha de registro', () => {
    expect(calcularExpiracionInicial(new Date('2026-08-04T09:30:00.000Z'))).toEqual(
      new Date('2026-09-04T09:30:00.000Z'),
    );
  });

  it('ajusta correctamente los registros del último día del mes', () => {
    expect(calcularExpiracionInicial(new Date('2026-01-31T18:45:00.000Z'))).toEqual(
      new Date('2026-02-28T18:45:00.000Z'),
    );
  });

  it('abre un ciclo completo al activar una cuenta', () => {
    expect(calcularNuevaExpiracionAlActivar(new Date('2026-08-15T16:00:00.000Z'))).toEqual(
      new Date('2026-09-15T16:00:00.000Z'),
    );
  });
});
