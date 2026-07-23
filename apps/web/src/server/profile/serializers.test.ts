import type { NutritionistProfile, Subscription, User } from '@prisma/client';

import { serializarPerfil } from './serializers';

describe('serializarPerfil', () => {
  it('expone la marca y omite datos internos de la cuenta', () => {
    const ahora = new Date('2026-07-23T12:00:00.000Z');
    const usuario = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'profesional@example.test',
      name: 'Profesional Prueba',
      role: 'NUTRITIONIST',
      emailVerified: ahora,
      nutritionistProfile: {
        id: '22222222-2222-4222-8222-222222222222',
        userId: '11111111-1111-4111-8111-111111111111',
        nombreCompleto: 'Profesional Prueba',
        cedulaProfesional: 'TEST-123',
        telefono: null,
        especialidad: 'Nutrición clínica',
        bio: null,
        marcaNombre: 'Consulta Prueba',
        marcaColor: '#166534',
        marcaLogoUrl: null,
        createdAt: ahora,
        updatedAt: ahora,
      } satisfies NutritionistProfile,
      subscription: {
        plan: 'PRO',
        status: 'ACTIVE',
        currentPeriodEnd: ahora,
      } satisfies Pick<Subscription, 'plan' | 'status' | 'currentPeriodEnd'>,
    } satisfies Pick<User, 'id' | 'email' | 'name' | 'role' | 'emailVerified'> & {
      nutritionistProfile: NutritionistProfile;
      subscription: Pick<Subscription, 'plan' | 'status' | 'currentPeriodEnd'>;
    };

    expect(serializarPerfil(usuario)).toEqual(
      expect.objectContaining({
        email_verificado: true,
        perfil: expect.objectContaining({
          marca_nombre: 'Consulta Prueba',
          marca_color: '#166534',
        }),
        suscripcion: expect.objectContaining({
          plan: 'PRO',
          current_period_end: ahora.toISOString(),
        }),
      }),
    );
    expect(serializarPerfil(usuario)).not.toHaveProperty('passwordHash');
  });
});
