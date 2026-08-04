/** @jest-environment node */
jest.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import { authConfig } from './config';

describe('sesiones con vigencia de cuenta', () => {
  it('deja pasar en edge un JWT legacy sin claim para que Node consulte la BD', async () => {
    const callback = authConfig.callbacks?.session;
    if (typeof callback !== 'function') throw new Error('Falta callback de sesión');

    const session = { user: { name: null, email: null, image: null }, expires: '' };
    const resultado = await callback({
      session,
      token: { userId: 'user-1', role: 'NUTRITIONIST', emailVerificado: true },
      newSession: undefined,
      trigger: 'update',
      user: undefined,
    } as never);

    expect(resultado.user.cuentaActiva).toBe(true);
  });

  it('conserva el bloqueo explícito de un inicio de sesión vencido', async () => {
    const callback = authConfig.callbacks?.session;
    if (typeof callback !== 'function') throw new Error('Falta callback de sesión');

    const session = { user: { name: null, email: null, image: null }, expires: '' };
    const resultado = await callback({
      session,
      token: {
        userId: 'user-1',
        role: 'NUTRITIONIST',
        emailVerificado: true,
        cuentaActiva: false,
      },
      newSession: undefined,
      trigger: 'update',
      user: undefined,
    } as never);

    expect(resultado.user.cuentaActiva).toBe(false);
  });
});
