/** @jest-environment node */
import { aplicarEstadoStripe } from './repository';

const mockUserFindUnique = jest.fn();
const mockSubscriptionUpsert = jest.fn();
const mockTransaction = jest.fn();
const mockTxQueryRaw = jest.fn();
const mockTxSubscriptionFindUniqueOrThrow = jest.fn();
const mockTxSubscriptionUpdate = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    subscription: {
      upsert: (...args: unknown[]) => mockSubscriptionUpsert(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const EVENTO_CANCELADO = {
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_1',
  stripePriceId: 'price_1',
  plan: 'PRO' as const,
  status: 'CANCELED' as const,
  currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserFindUnique.mockResolvedValue({ createdAt: new Date('2026-01-01T00:00:00.000Z') });
  mockSubscriptionUpsert.mockResolvedValue({});
  mockTxSubscriptionUpdate.mockResolvedValue({});
  mockTxQueryRaw.mockResolvedValue([{ id: 'subscription-1' }]);
  mockTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
    callback({
      $queryRaw: (...args: unknown[]) => mockTxQueryRaw(...args),
      subscription: {
        findUniqueOrThrow: (...args: unknown[]) => mockTxSubscriptionFindUniqueOrThrow(...args),
        update: (...args: unknown[]) => mockTxSubscriptionUpdate(...args),
      },
    }),
  );
});

describe('aplicarEstadoStripe', () => {
  it('un webhook viejo no recorta una activación manual vigente', async () => {
    const accesoManual = new Date('2099-09-04T00:00:00.000Z');
    mockTxSubscriptionFindUniqueOrThrow.mockResolvedValue({
      plan: 'PRO',
      status: 'ACTIVE',
      accessExpiresAt: accesoManual,
    });

    await aplicarEstadoStripe('user-1', EVENTO_CANCELADO);

    expect(mockTxQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockTxSubscriptionUpdate).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: expect.objectContaining({
        plan: 'PRO',
        status: 'ACTIVE',
        accessExpiresAt: accesoManual,
      }),
    });
  });

  it('adopta un periodo de Stripe posterior al acceso local', async () => {
    mockTxSubscriptionFindUniqueOrThrow.mockResolvedValue({
      plan: 'PRO',
      status: 'ACTIVE',
      accessExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    const finStripe = new Date('2099-12-01T00:00:00.000Z');

    await aplicarEstadoStripe('user-1', {
      ...EVENTO_CANCELADO,
      status: 'ACTIVE',
      currentPeriodEnd: finStripe,
    });

    expect(mockTxSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accessExpiresAt: finStripe }) }),
    );
  });
});
