/**
 * @jest-environment node
 */
import { Prisma } from '@prisma/client';

import { activarCuentaPaciente, invitarPaciente } from './invitaciones';
import { hashToken } from './tokens';

const mockPatientFindFirst = jest.fn();
const mockPatientUpdateMany = jest.fn();
const mockInviteFindUnique = jest.fn();
const mockInviteCreate = jest.fn();
const mockInviteUpdateMany = jest.fn();
const mockUserCreate = jest.fn();
const mockTransaction = jest.fn();
const mockAudit = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    patient: {
      findFirst: (...args: unknown[]) => mockPatientFindFirst(...args),
      updateMany: (...args: unknown[]) => mockPatientUpdateMany(...args),
    },
    patientInvite: {
      findUnique: (...args: unknown[]) => mockInviteFindUnique(...args),
      create: (...args: unknown[]) => mockInviteCreate(...args),
      updateMany: (...args: unknown[]) => mockInviteUpdateMany(...args),
    },
    user: { create: (...args: unknown[]) => mockUserCreate(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/server/audit', () => ({
  recordAuditEvent: (...args: unknown[]) => mockAudit(...args),
}));

const PACIENTE_ID = '11111111-1111-4111-8111-111111111111';
const NUTRIOLOGO_ID = '22222222-2222-4222-8222-222222222222';

const PACIENTE_INVITABLE = {
  id: PACIENTE_ID,
  nombre: 'Paciente Prueba',
  email: 'Paciente@Ejemplo.MX',
  estado: 'ACTIVO',
  userId: null,
  sensitiveDataConsentAt: new Date('2026-07-01T00:00:00Z'),
  nutritionist: { name: 'Consultorio Nutria' },
};

const EN_UNA_HORA = () => new Date(Date.now() + 60 * 60 * 1000);
const HACE_UNA_HORA = () => new Date(Date.now() - 60 * 60 * 1000);

const INVITACION_VIGENTE = {
  id: 'inv-1',
  email: 'paciente@ejemplo.mx',
  usedAt: null,
  expiresAt: EN_UNA_HORA(),
  patient: {
    id: PACIENTE_ID,
    userId: null,
    estado: 'ACTIVO',
    deletedAt: null,
    nutritionist: { name: 'Consultorio Nutria' },
  },
};

/** Simula la transacción interactiva ejecutando el callback con los mocks. */
function transaccionQueEjecuta() {
  return mockTransaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => Promise<unknown>)({
          user: { create: mockUserCreate },
          patient: { updateMany: mockPatientUpdateMany },
          patientInvite: { updateMany: mockInviteUpdateMany },
        })
      : [],
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockResolvedValue([]);
});

describe('invitarPaciente', () => {
  it('emite un token e invalida las invitaciones anteriores', async () => {
    mockPatientFindFirst.mockResolvedValue(PACIENTE_INVITABLE);

    const resultado = await invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID);

    if (!resultado.ok) throw new Error('debía invitar');
    expect(resultado.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(resultado.expiraEn.getTime()).toBeGreaterThan(Date.now());
    expect(mockInviteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: PACIENTE_ID, usedAt: null } }),
    );
  });

  it('guarda el hash del token, nunca el token en claro', async () => {
    mockPatientFindFirst.mockResolvedValue(PACIENTE_INVITABLE);

    const resultado = await invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID);

    if (!resultado.ok) throw new Error('debía invitar');
    const [{ data }] = mockInviteCreate.mock.calls[0] as [{ data: Record<string, string> }];
    expect(data.tokenHash).toBe(hashToken(resultado.token));
    expect(JSON.stringify(data)).not.toContain(resultado.token);
  });

  it('normaliza el correo del expediente antes de guardarlo', async () => {
    mockPatientFindFirst.mockResolvedValue(PACIENTE_INVITABLE);

    const resultado = await invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID);

    if (!resultado.ok) throw new Error('debía invitar');
    expect(resultado.email).toBe('paciente@ejemplo.mx');
  });

  it('devuelve los datos del correo desde la consulta con filtro de pertenencia', async () => {
    mockPatientFindFirst.mockResolvedValue(PACIENTE_INVITABLE);

    const resultado = await invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID);

    if (!resultado.ok) throw new Error('debía invitar');
    // Sin segunda consulta al paciente: la primera ya validó que es propio.
    expect(mockPatientFindFirst).toHaveBeenCalledTimes(1);
    expect(resultado.pacienteNombre).toBe('Paciente Prueba');
    expect(resultado.consultorio).toBe('Consultorio Nutria');
  });

  it('usa un remitente genérico si el nutriólogo no tiene nombre', async () => {
    mockPatientFindFirst.mockResolvedValue({
      ...PACIENTE_INVITABLE,
      nutritionist: { name: null },
    });

    const resultado = await invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID);

    if (!resultado.ok) throw new Error('debía invitar');
    expect(resultado.consultorio).toBe('Tu profesional de nutrición');
  });

  it('filtra por nutriólogo dentro de la misma consulta', async () => {
    mockPatientFindFirst.mockResolvedValue(PACIENTE_INVITABLE);

    await invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID);

    expect(mockPatientFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PACIENTE_ID, nutritionistId: NUTRIOLOGO_ID, deletedAt: null },
      }),
    );
  });

  it('rechaza un id que no es UUID sin tocar la base', async () => {
    await expect(invitarPaciente(NUTRIOLOGO_ID, 'no-es-uuid')).resolves.toEqual({
      ok: false,
      motivo: 'no_encontrado',
    });
    expect(mockPatientFindFirst).not.toHaveBeenCalled();
  });

  it('rechaza al paciente de otro nutriólogo como inexistente', async () => {
    mockPatientFindFirst.mockResolvedValue(null);

    await expect(invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID)).resolves.toEqual({
      ok: false,
      motivo: 'no_encontrado',
    });
  });

  it('rechaza al paciente archivado', async () => {
    mockPatientFindFirst.mockResolvedValue({ ...PACIENTE_INVITABLE, estado: 'ARCHIVADO' });

    await expect(invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID)).resolves.toEqual({
      ok: false,
      motivo: 'archivado',
    });
    expect(mockInviteCreate).not.toHaveBeenCalled();
  });

  it('rechaza al paciente que ya tiene cuenta', async () => {
    mockPatientFindFirst.mockResolvedValue({ ...PACIENTE_INVITABLE, userId: 'user-9' });

    await expect(invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID)).resolves.toEqual({
      ok: false,
      motivo: 'ya_vinculado',
    });
  });

  it('rechaza al paciente sin correo en el expediente', async () => {
    mockPatientFindFirst.mockResolvedValue({ ...PACIENTE_INVITABLE, email: null });

    await expect(invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID)).resolves.toEqual({
      ok: false,
      motivo: 'sin_correo',
    });
  });

  it('rechaza al paciente sin consentimiento de datos sensibles', async () => {
    mockPatientFindFirst.mockResolvedValue({
      ...PACIENTE_INVITABLE,
      sensitiveDataConsentAt: null,
    });

    await expect(invitarPaciente(NUTRIOLOGO_ID, PACIENTE_ID)).resolves.toEqual({
      ok: false,
      motivo: 'sin_consentimiento',
    });
    expect(mockInviteCreate).not.toHaveBeenCalled();
  });
});

describe('activarCuentaPaciente', () => {
  beforeEach(() => {
    transaccionQueEjecuta();
    mockUserCreate.mockResolvedValue({ id: 'user-nuevo' });
    mockPatientUpdateMany.mockResolvedValue({ count: 1 });
    mockInviteUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('crea la cuenta, la enlaza al expediente y quema el token', async () => {
    mockInviteFindUnique.mockResolvedValue(INVITACION_VIGENTE);

    const resultado = await activarCuentaPaciente('token-valido', 'contraseña-larga');

    expect(resultado).toEqual({
      ok: true,
      userId: 'user-nuevo',
      patientId: PACIENTE_ID,
      email: 'paciente@ejemplo.mx',
      consultorio: 'Consultorio Nutria',
    });
    expect(mockPatientUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PACIENTE_ID, userId: null, deletedAt: null },
      }),
    );
    expect(mockInviteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1', usedAt: null } }),
    );
  });

  it('crea al usuario con rol de paciente, correo verificado y aviso aceptado', async () => {
    mockInviteFindUnique.mockResolvedValue(INVITACION_VIGENTE);

    await activarCuentaPaciente('token-valido', 'contraseña-larga');

    const [{ data }] = mockUserCreate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.role).toBe('END_USER');
    expect(data.emailVerified).toBeInstanceOf(Date);
    expect(data.privacyNoticeAcceptedAt).toBeInstanceOf(Date);
  });

  it('guarda la contraseña hasheada, nunca en claro', async () => {
    mockInviteFindUnique.mockResolvedValue(INVITACION_VIGENTE);

    await activarCuentaPaciente('token-valido', 'contraseña-larga');

    const [{ data }] = mockUserCreate.mock.calls[0] as [{ data: { passwordHash: string } }];
    expect(data.passwordHash).not.toBe('contraseña-larga');
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('busca por el hash del token, nunca por el token en claro', async () => {
    mockInviteFindUnique.mockResolvedValue(null);

    await activarCuentaPaciente('token-valido', 'contraseña-larga');

    expect(mockInviteFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken('token-valido') } }),
    );
  });

  it('deja el registro en la bitácora clínica', async () => {
    mockInviteFindUnique.mockResolvedValue(INVITACION_VIGENTE);

    await activarCuentaPaciente('token-valido', 'contraseña-larga');

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PATIENT_APP_ACCESS_ACTIVATED',
        resource: 'patient',
        resourceId: PACIENTE_ID,
      }),
    );
  });

  it('rechaza un token inexistente', async () => {
    mockInviteFindUnique.mockResolvedValue(null);

    await expect(activarCuentaPaciente('inventado', 'contraseña-larga')).resolves.toEqual({
      ok: false,
      motivo: 'invalido',
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('trata el token que apagó una reinvitación como reemplazado, no como inválido', async () => {
    mockInviteFindUnique.mockResolvedValue({ ...INVITACION_VIGENTE, usedAt: new Date() });

    await expect(activarCuentaPaciente('reusado', 'contraseña-larga')).resolves.toEqual({
      ok: false,
      motivo: 'reemplazado',
    });
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('distingue el token gastado que sí creó la cuenta del que quedó reemplazado', async () => {
    mockInviteFindUnique.mockResolvedValue({
      ...INVITACION_VIGENTE,
      usedAt: new Date(),
      patient: { ...INVITACION_VIGENTE.patient, userId: 'user-previo' },
    });

    await expect(activarCuentaPaciente('reusado', 'contraseña-larga')).resolves.toEqual({
      ok: false,
      motivo: 'ya_vinculado',
    });
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('un token vencido y además reemplazado se rechaza como reemplazado', async () => {
    mockInviteFindUnique.mockResolvedValue({
      ...INVITACION_VIGENTE,
      usedAt: new Date(),
      expiresAt: HACE_UNA_HORA(),
    });

    await expect(activarCuentaPaciente('viejo', 'contraseña-larga')).resolves.toEqual({
      ok: false,
      motivo: 'reemplazado',
    });
  });

  it('distingue el token vencido para poder ofrecer una nueva invitación', async () => {
    mockInviteFindUnique.mockResolvedValue({
      ...INVITACION_VIGENTE,
      expiresAt: HACE_UNA_HORA(),
    });

    await expect(activarCuentaPaciente('vencido', 'contraseña-larga')).resolves.toEqual({
      ok: false,
      motivo: 'expirado',
    });
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('rechaza si el paciente ya quedó vinculado a otra cuenta', async () => {
    mockInviteFindUnique.mockResolvedValue({
      ...INVITACION_VIGENTE,
      patient: { ...INVITACION_VIGENTE.patient, userId: 'user-previo' },
    });

    await expect(activarCuentaPaciente('token-valido', 'contraseña-larga')).resolves.toEqual({
      ok: false,
      motivo: 'ya_vinculado',
    });
  });

  it('revierte la transacción si otra petición gana la carrera del enlace', async () => {
    mockInviteFindUnique.mockResolvedValue(INVITACION_VIGENTE);
    mockPatientUpdateMany.mockResolvedValue({ count: 0 });

    await expect(activarCuentaPaciente('token-valido', 'contraseña-larga')).resolves.toEqual({
      ok: false,
      motivo: 'ya_vinculado',
    });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('rechaza al paciente archivado o borrado', async () => {
    mockInviteFindUnique.mockResolvedValue({
      ...INVITACION_VIGENTE,
      patient: { ...INVITACION_VIGENTE.patient, estado: 'ARCHIVADO' },
    });

    await expect(activarCuentaPaciente('token-valido', 'contraseña-larga')).resolves.toEqual({
      ok: false,
      motivo: 'paciente_inactivo',
    });
  });

  it('traduce el correo ya registrado en un motivo propio', async () => {
    mockInviteFindUnique.mockResolvedValue(INVITACION_VIGENTE);
    mockUserCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicado', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(activarCuentaPaciente('token-valido', 'contraseña-larga')).resolves.toEqual({
      ok: false,
      motivo: 'correo_ocupado',
    });
  });
});
