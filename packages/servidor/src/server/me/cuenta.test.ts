/**
 * @jest-environment node
 */
import {
  cambiarPassword,
  darDeBajaCuenta,
  ExportacionDemasiadoGrandeError,
  exportarDatosDelPaciente,
  verificarPassword,
} from './cuenta';

const mockPatientFindFirst = jest.fn();
const mockPatientUpdate = jest.fn();
const mockUserFindFirst = jest.fn();
const mockUserUpdate = jest.fn();
const mockTransaction = jest.fn();
const mockAuditCreate = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    patient: {
      findFirst: (...a: unknown[]) => mockPatientFindFirst(...a),
      update: (...a: unknown[]) => mockPatientUpdate(...a),
    },
    user: {
      findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
    auditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

jest.mock('@/server/crypto', () => ({
  decryptText: (texto: string) => `descifrado:${texto}`,
  ENCRYPTION_CONTEXT: { messageText: 'message.texto' },
}));

const mockHash = jest.fn();
const mockVerify = jest.fn();
jest.mock('@/server/auth/password', () => ({
  hashPassword: (...a: unknown[]) => mockHash(...a),
  verifyPassword: (...a: unknown[]) => mockVerify(...a),
}));

const NUTRIOLOGA = {
  name: 'consultorio@nutria.mx',
  email: 'ana@nutria.mx',
  nutritionistProfile: { nombreCompleto: 'Ana Salinas' },
};

function conteoVacio(extra: Record<string, number> = {}) {
  return {
    _count: {
      measurements: 0,
      mealPlans: 0,
      mealLogs: 0,
      weightLogs: 0,
      exerciseLogs: 0,
      waterLogs: 0,
      activityPlans: 0,
      appointments: 0,
      messages: 0,
      recipes: 0,
      ...extra,
    },
  };
}

function pacienteExportable(extra: Record<string, unknown> = {}) {
  return {
    id: 'paciente-1',
    nombre: 'Camila Ruiz',
    fechaNacimiento: null,
    genero: 'FEMENINO',
    email: 'camila@correo.mx',
    telefono: null,
    estado: 'ACTIVO',
    medicalRecord: { objetivo: 'PERDIDA_DE_GRASA', objetivoOtro: null },
    sensitiveDataConsentAt: null,
    sensitiveDataConsentVersion: null,
    sensitiveDataConsentMethod: null,
    privacyNoticeSentAt: null,
    foodPreference: null,
    measurements: [],
    mealPlans: [],
    recipes: [],
    activityPlans: [],
    mealLogs: [],
    weightLogs: [],
    exerciseLogs: [],
    waterLogs: [],
    appointments: [],
    messages: [],
    nutritionist: NUTRIOLOGA,
    ...extra,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('exportarDatosDelPaciente', () => {
  it('exporta solo el expediente del paciente de la sesión', async () => {
    mockPatientFindFirst.mockResolvedValueOnce(conteoVacio()).mockResolvedValueOnce(
      pacienteExportable(),
    );

    await exportarDatosDelPaciente('paciente-1');

    // Las dos consultas filtran por id propio y por `deletedAt: null`; ninguna
    // acepta un id que venga de fuera de la sesión.
    for (const llamada of mockPatientFindFirst.mock.calls) {
      expect(llamada[0].where).toEqual({ id: 'paciente-1', deletedAt: null });
    }
  });

  it('no incluye notas de consulta ni el texto libre del expediente clínico', async () => {
    mockPatientFindFirst.mockResolvedValueOnce(conteoVacio()).mockResolvedValueOnce(
      pacienteExportable(),
    );

    const datos = await exportarDatosDelPaciente('paciente-1');
    const serializado = JSON.stringify(datos);

    // §9: el expediente clínico es responsabilidad de la nutrióloga
    // (NOM-004-SSA3). Si alguien agrega `consultationNotes` al include, esto lo
    // delata.
    expect(serializado).not.toContain('consultationNotes');
    expect(serializado).not.toContain('notas_consulta');
    expect(datos!.expediente_clinico_completo.incluido).toBe(false);
  });

  it('dice a quién pedirle el expediente completo', async () => {
    mockPatientFindFirst.mockResolvedValueOnce(conteoVacio()).mockResolvedValueOnce(
      pacienteExportable(),
    );

    const datos = await exportarDatosDelPaciente('paciente-1');

    // El nombre profesional gana al del usuario, igual que en `perfilDe`.
    expect(datos!.expediente_clinico_completo.responsable).toBe('Ana Salinas');
    expect(datos!.expediente_clinico_completo.contacto).toBe('ana@nutria.mx');
  });

  it('solo trae planes y recetas que la nutrióloga ya compartió', async () => {
    mockPatientFindFirst.mockResolvedValueOnce(conteoVacio()).mockResolvedValueOnce(
      pacienteExportable(),
    );

    await exportarDatosDelPaciente('paciente-1');

    const include = mockPatientFindFirst.mock.calls[1]![0].include;
    // Un borrador que ella no ha enviado no puede salir por una exportación.
    expect(include.mealPlans.where).toEqual({ compartidoAt: { not: null } });
    expect(include.recipes.where).toEqual({ estado: 'ENVIADA' });
    expect(include.activityPlans.where).toEqual({ compartidoAt: { not: null } });
  });

  it('descifra los mensajes en vez de exportar el ciphertext', async () => {
    mockPatientFindFirst.mockResolvedValueOnce(conteoVacio({ messages: 1 })).mockResolvedValueOnce(
      pacienteExportable({
        messages: [
          {
            id: 'm1',
            emisor: 'PATIENT',
            texto: 'cifrado',
            leidoAt: null,
            createdAt: new Date(),
          },
        ],
      }),
    );

    const datos = await exportarDatosDelPaciente('paciente-1');

    expect(datos!.paciente.mensajes[0]!.texto).toBe('descifrado:cifrado');
  });

  it('devuelve null si el expediente no existe o está borrado', async () => {
    mockPatientFindFirst.mockResolvedValueOnce(null);

    expect(await exportarDatosDelPaciente('paciente-1')).toBeNull();
  });

  it('rechaza un expediente enorme en vez de tumbar el servidor', async () => {
    mockPatientFindFirst.mockResolvedValueOnce(conteoVacio({ mealLogs: 10_001 }));

    await expect(exportarDatosDelPaciente('paciente-1')).rejects.toBeInstanceOf(
      ExportacionDemasiadoGrandeError,
    );
  });
});

describe('cambiarPassword', () => {
  it('rechaza sin tocar la base si la contraseña actual no coincide', async () => {
    mockUserFindFirst.mockResolvedValue({ passwordHash: 'hash-viejo' });
    mockVerify.mockResolvedValue(false);

    expect(await cambiarPassword('user-1', 'incorrecta', 'nueva-larga-123')).toEqual({
      ok: false,
      motivo: 'password_incorrecta',
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it('guarda el hash de la nueva, nunca el texto plano', async () => {
    mockUserFindFirst.mockResolvedValue({ passwordHash: 'hash-viejo' });
    mockVerify.mockResolvedValue(true);
    mockHash.mockResolvedValue('hash-nuevo');

    expect(await cambiarPassword('user-1', 'actual', 'nueva-larga-123')).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'hash-nuevo' },
    });
  });

  it('deja rastro en la bitácora sin escribir la contraseña', async () => {
    mockUserFindFirst.mockResolvedValue({ passwordHash: 'hash-viejo' });
    mockVerify.mockResolvedValue(true);
    mockHash.mockResolvedValue('hash-nuevo');

    await cambiarPassword('user-1', 'actual', 'nueva-larga-123');

    const auditado = JSON.stringify(mockAuditCreate.mock.calls[0]![0]);
    expect(auditado).toContain('PATIENT_PASSWORD_CHANGED');
    expect(auditado).not.toContain('nueva-larga-123');
    expect(auditado).not.toContain('hash-nuevo');
  });

  it('no revienta si la cuenta ya no existe', async () => {
    mockUserFindFirst.mockResolvedValue(null);

    expect(await cambiarPassword('user-1', 'a', 'nueva-larga-123')).toEqual({
      ok: false,
      motivo: 'sin_cuenta',
    });
  });
});

describe('verificarPassword', () => {
  it('devuelve false ante una cuenta borrada, sin lanzar', async () => {
    mockUserFindFirst.mockResolvedValue(null);
    mockVerify.mockResolvedValue(false);

    expect(await verificarPassword('user-1', 'lo-que-sea')).toBe(false);
  });
});

describe('darDeBajaCuenta', () => {
  beforeEach(() => {
    mockPatientFindFirst.mockResolvedValue({ nombre: 'Camila Ruiz', nutritionist: NUTRIOLOGA });
    mockTransaction.mockResolvedValue([]);
  });

  it('desvincula el expediente y borra la cuenta en una sola transacción', async () => {
    await darDeBajaCuenta('paciente-1', 'user-1');

    // Una cuenta desvinculada pero viva, o muerta y todavía vinculada, deja un
    // estado que ningún guard sabe leer.
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockPatientUpdate).toHaveBeenCalledWith({
      where: { id: 'paciente-1' },
      data: { userId: null },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('NO borra el expediente clínico: solo lo desvincula', async () => {
    await darDeBajaCuenta('paciente-1', 'user-1');

    // §9: el expediente permanece con la nutrióloga, que es su responsable ante
    // la NOM-004. Un `patient.delete` o un `deletedAt` sobre el paciente aquí
    // sería que el paciente destruyera el registro clínico de un tercero.
    const escrituras = mockPatientUpdate.mock.calls.map((llamada) => llamada[0].data);
    expect(escrituras).toEqual([{ userId: null }]);
  });

  it('devuelve a quién avisar de la baja', async () => {
    const resultado = await darDeBajaCuenta('paciente-1', 'user-1');

    expect(resultado.nutriologo).toEqual({ nombre: 'Ana Salinas', email: 'ana@nutria.mx' });
    expect(resultado.pacienteNombre).toBe('Camila Ruiz');
  });

  it('registra la baja en la bitácora', async () => {
    await darDeBajaCuenta('paciente-1', 'user-1');

    const auditado = mockAuditCreate.mock.calls[0]![0].data;
    expect(auditado.accion).toBe('PATIENT_ACCOUNT_DELETED');
    expect(auditado.metadata).toMatchObject({ expediente_conservado: true });
  });
});
