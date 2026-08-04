/** @jest-environment node */
import { asegurarCuentaNutriologo } from './provisioning';

const mockProfileUpsert = jest.fn();
const mockSubscriptionUpsert = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    nutritionistProfile: { upsert: (...args: unknown[]) => mockProfileUpsert(...args) },
    subscription: { upsert: (...args: unknown[]) => mockSubscriptionUpsert(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockProfileUpsert.mockReturnValue({ tipo: 'perfil' });
  mockSubscriptionUpsert.mockReturnValue({ tipo: 'suscripcion' });
  mockTransaction.mockResolvedValue([]);
});

describe('asegurarCuentaNutriologo', () => {
  it('provisiona Pro con un mes desde la fecha original de registro', async () => {
    const registro = new Date('2026-01-31T12:00:00.000Z');

    await asegurarCuentaNutriologo('user-1', 'Nutrióloga de prueba', registro);

    expect(mockSubscriptionUpsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: {},
      create: {
        userId: 'user-1',
        plan: 'PRO',
        accessExpiresAt: new Date('2026-02-28T12:00:00.000Z'),
      },
    });
  });
});
