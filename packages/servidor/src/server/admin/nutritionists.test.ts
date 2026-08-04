/** @jest-environment node */
import {
  activarNutriologa,
  listarNutriologas,
  NutriologaGestionadaPorStripeError,
} from './nutritionists';

const mockTransaction = jest.fn();
const mockUserFindMany = jest.fn();
const mockUserCount = jest.fn();
const mockSubscriptionCount = jest.fn();
const mockTxUserFindFirst = jest.fn();
const mockTxSubscriptionUpsert = jest.fn();
const mockTxSubscriptionFindUniqueOrThrow = jest.fn();
const mockTxSubscriptionUpdate = jest.fn();
const mockTxAuditLogCreate = jest.fn();
const mockTxQueryRaw = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      count: (...args: unknown[]) => mockUserCount(...args),
    },
    subscription: { count: (...args: unknown[]) => mockSubscriptionCount(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const FILA = {
  id: 'nutri-1',
  name: 'Nombre de cuenta',
  email: 'nutriologa@nutria.test',
  createdAt: new Date('2026-07-01T12:00:00.000Z'),
  nutritionistProfile: { nombreCompleto: 'Nutrióloga de prueba' },
  subscription: {
    plan: 'PRO',
    accessExpiresAt: new Date('2026-09-04T12:00:00.000Z'),
    lastActivatedAt: new Date('2026-08-04T12:00:00.000Z'),
    lastActivatedByUserId: 'admin-1',
    activationNote: 'Pago de prueba',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation(async (entrada: unknown) => {
    if (typeof entrada === 'function') {
      return entrada({
        user: { findFirst: (...args: unknown[]) => mockTxUserFindFirst(...args) },
        subscription: {
          upsert: (...args: unknown[]) => mockTxSubscriptionUpsert(...args),
          findUniqueOrThrow: (...args: unknown[]) => mockTxSubscriptionFindUniqueOrThrow(...args),
          update: (...args: unknown[]) => mockTxSubscriptionUpdate(...args),
        },
        auditLog: { create: (...args: unknown[]) => mockTxAuditLogCreate(...args) },
        $queryRaw: (...args: unknown[]) => mockTxQueryRaw(...args),
      });
    }
    return Promise.all(entrada as Promise<unknown>[]);
  });
});

describe('activarNutriologa', () => {
  it('asigna Pro por un mes y registra la auditoría', async () => {
    const ahora = new Date('2026-08-04T12:00:00.000Z');
    mockTxUserFindFirst.mockResolvedValueOnce({ id: 'nutri-1' }).mockResolvedValueOnce(FILA);
    mockTxSubscriptionUpsert.mockResolvedValue({ id: 'sub-1' });
    mockTxSubscriptionFindUniqueOrThrow.mockResolvedValue({
      id: 'sub-1',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      accessExpiresAt: new Date('2026-08-01T12:00:00.000Z'),
    });
    mockTxSubscriptionUpdate.mockResolvedValue({ id: 'sub-1' });
    mockTxQueryRaw.mockResolvedValue([{ id: 'sub-1' }]);
    mockTxAuditLogCreate.mockResolvedValue({});

    const resultado = await activarNutriologa('nutri-1', 'admin-1', ' Pago de prueba ', ahora);

    expect(mockTxSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'nutri-1' },
        data: expect.objectContaining({
          plan: 'PRO',
          status: 'ACTIVE',
          accessExpiresAt: new Date('2026-09-04T12:00:00.000Z'),
          lastActivatedAt: ahora,
          lastActivatedByUserId: 'admin-1',
          activationNote: 'Pago de prueba',
        }),
      }),
    );
    expect(resultado).toMatchObject({ estado_cuenta: 'ACTIVA', primer_mes_gratis: false });
    expect(mockTxAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        accion: 'subscription.manual_activation',
        recursoId: 'sub-1',
      }),
    });
  });

  it('no crea suscripción si el id no pertenece a una nutrióloga', async () => {
    mockTxUserFindFirst.mockResolvedValue(null);

    await expect(activarNutriologa('otro-id', 'admin-1', undefined)).resolves.toBeNull();
    expect(mockTxSubscriptionUpsert).not.toHaveBeenCalled();
  });

  it('rechaza la activación manual de una cuenta gestionada por Stripe', async () => {
    mockTxUserFindFirst.mockResolvedValue({ id: 'nutri-1' });
    mockTxSubscriptionUpsert.mockResolvedValue({ id: 'sub-1' });
    mockTxQueryRaw.mockResolvedValue([{ id: 'sub-1' }]);
    mockTxSubscriptionFindUniqueOrThrow.mockResolvedValue({
      id: 'sub-1',
      stripeCustomerId: 'cus_stripe',
      stripeSubscriptionId: null,
      accessExpiresAt: new Date('2026-09-04T12:00:00.000Z'),
    });

    await expect(activarNutriologa('nutri-1', 'admin-1', undefined)).rejects.toBeInstanceOf(
      NutriologaGestionadaPorStripeError,
    );
    expect(mockTxSubscriptionUpdate).not.toHaveBeenCalled();
    expect(mockTxAuditLogCreate).not.toHaveBeenCalled();
  });
});

describe('listarNutriologas', () => {
  it('calcula el estado con la fecha de acceso y conserva la paginación', async () => {
    mockUserFindMany.mockResolvedValue([FILA]);
    mockUserCount.mockResolvedValue(1);
    mockSubscriptionCount.mockResolvedValue(1);

    const resultado = await listarNutriologas(0, 20, new Date('2026-08-04T12:00:00.000Z'));

    expect(resultado.total).toBe(1);
    expect(resultado).toMatchObject({ activas: 1, bloqueadas: 0 });
    expect(resultado.data[0]).toMatchObject({
      nombre: 'Nutrióloga de prueba',
      estado_cuenta: 'ACTIVA',
      acceso_expira: '2026-09-04T12:00:00.000Z',
    });
  });
});
