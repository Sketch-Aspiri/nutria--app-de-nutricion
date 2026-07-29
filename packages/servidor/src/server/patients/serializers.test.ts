/**
 * @jest-environment node
 */
import type { Patient } from '@prisma/client';

import { type InvitacionVigente, serializarAccesoApp } from './serializers';

const PACIENTE_SIN_CUENTA = { userId: null } as Patient;
const PACIENTE_CON_CUENTA = { userId: 'user-1' } as Patient;

function invitacion(expiraEn: Date): InvitacionVigente {
  return { createdAt: new Date('2026-07-20T10:00:00Z'), expiresAt: expiraEn };
}

const EN_UN_DIA = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
const AYER = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

describe('serializarAccesoApp', () => {
  it('marca la cuenta activa cuando el expediente ya está vinculado', () => {
    const acceso = serializarAccesoApp(PACIENTE_CON_CUENTA, []);

    expect(acceso.cuenta_activa).toBe(true);
  });

  it('reporta la invitación vigente con sus fechas en ISO', () => {
    const expira = EN_UN_DIA();

    const acceso = serializarAccesoApp(PACIENTE_SIN_CUENTA, [invitacion(expira)]);

    expect(acceso).toEqual({
      cuenta_activa: false,
      invitacion_pendiente: {
        enviada_en: '2026-07-20T10:00:00.000Z',
        expira_en: expira.toISOString(),
      },
    });
  });

  it('ignora la invitación vencida para poder ofrecer una nueva', () => {
    const acceso = serializarAccesoApp(PACIENTE_SIN_CUENTA, [invitacion(AYER())]);

    expect(acceso.invitacion_pendiente).toBeNull();
  });

  it('no expone el identificador de usuario ni el token', () => {
    const acceso = serializarAccesoApp(PACIENTE_CON_CUENTA, [invitacion(EN_UN_DIA())]);

    expect(JSON.stringify(acceso)).not.toContain('user-1');
    expect(Object.keys(acceso)).toEqual(['cuenta_activa', 'invitacion_pendiente']);
  });
});
