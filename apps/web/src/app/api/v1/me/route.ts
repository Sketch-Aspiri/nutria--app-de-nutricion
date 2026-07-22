import { requiereNutriologo } from '@/server/auth/guards';
import { prisma } from '@/server/db';
import { internalError, jsonOk, notFound } from '@/server/http';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

/** GET /api/v1/me — perfil, marca blanca y plan del nutriólogo autenticado. */
export async function GET() {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const usuario = await prisma.user.findUnique({
      where: { id: sesion.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        nutritionistProfile: true,
        subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
      },
    });

    if (!usuario) return notFound('No se encontró la cuenta.');

    return jsonOk({
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
    });
  } catch (error: unknown) {
    logger.error('Falló la lectura del perfil', error);
    return internalError();
  }
}
