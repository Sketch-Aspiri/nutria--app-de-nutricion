import type { NutritionistProfile, Subscription, User } from '@prisma/client';

type UsuarioConPerfil = Pick<User, 'id' | 'email' | 'name' | 'role' | 'emailVerified'> & {
  nutritionistProfile: NutritionistProfile | null;
  subscription: Pick<Subscription, 'plan' | 'status' | 'currentPeriodEnd'> | null;
};

/** Contrato público de `/api/v1/me`; nunca expone hashes ni identificadores de proveedores. */
export function serializarPerfil(usuario: UsuarioConPerfil) {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.name,
    role: usuario.role,
    email_verificado: Boolean(usuario.emailVerified),
    perfil: usuario.nutritionistProfile && {
      nombre_completo: usuario.nutritionistProfile.nombreCompleto,
      cedula_profesional: usuario.nutritionistProfile.cedulaProfesional,
      telefono: usuario.nutritionistProfile.telefono,
      especialidad: usuario.nutritionistProfile.especialidad,
      marca_nombre: usuario.nutritionistProfile.marcaNombre,
      marca_color: usuario.nutritionistProfile.marcaColor,
      marca_logo_url: usuario.nutritionistProfile.marcaLogoUrl,
    },
    suscripcion: usuario.subscription && {
      plan: usuario.subscription.plan,
      status: usuario.subscription.status,
      current_period_end: usuario.subscription.currentPeriodEnd?.toISOString() ?? null,
    },
  };
}
