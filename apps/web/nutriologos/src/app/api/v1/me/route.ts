import { requiereNutriologo } from '@/server/auth/guards';
import { prisma } from '@/server/db';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import {
  borrarLogoMarca,
  type CambioLogoMarca,
  LogoStorageError,
  LogoStorageInputError,
  prepararCambioLogoMarca,
} from '@/server/profile/logoStorage';
import { actualizarPerfilSchema } from '@/server/profile/schemas';
import { serializarPerfil } from '@/server/profile/serializers';

export const dynamic = 'force-dynamic';

const SELECCION_PERFIL = {
  id: true,
  email: true,
  name: true,
  role: true,
  emailVerified: true,
  nutritionistProfile: true,
  subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
} as const;

/** GET /api/v1/me — perfil, marca blanca y plan del nutriólogo autenticado. */
export async function GET() {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const usuario = await prisma.user.findUnique({
      where: { id: sesion.userId },
      select: SELECCION_PERFIL,
    });

    if (!usuario) return notFound('No se encontró la cuenta.');
    return jsonOk(serializarPerfil(usuario));
  } catch (error: unknown) {
    logger.error('Falló la lectura del perfil', error);
    return internalError();
  }
}

/** PATCH /api/v1/me — persiste los datos profesionales usados por la marca blanca. */
export async function PATCH(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = actualizarPerfilSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const datos = parsed.data;
  let cambioLogo: CambioLogoMarca = {
    valorPersistir: undefined,
    urlNuevaSubida: null,
    urlAnteriorParaBorrar: null,
  };

  if (datos.marca_logo_url !== undefined) {
    try {
      const perfilActual = await prisma.nutritionistProfile.findUnique({
        where: { userId: sesion.userId },
        select: { marcaLogoUrl: true },
      });
      cambioLogo = await prepararCambioLogoMarca(
        sesion.userId,
        datos.marca_logo_url,
        perfilActual?.marcaLogoUrl ?? null,
      );
    } catch (error: unknown) {
      if (error instanceof LogoStorageInputError) {
        return jsonError(
          400,
          ErrorCode.VALIDATION_ERROR,
          'El logo enviado no es válido para esta cuenta.',
          { marca_logo_url: ['Selecciona nuevamente una imagen PNG o JPG.'] },
        );
      }
      if (error instanceof LogoStorageError) {
        return jsonError(
          503,
          ErrorCode.INTERNAL_ERROR,
          'No pudimos almacenar el logo. Intenta de nuevo en unos momentos.',
        );
      }
      logger.error('Falló la preparación del logo de marca', error);
      return internalError();
    }
  }

  let cambioLogoPersistido = false;
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: sesion.userId },
        data: {
          ...(datos.nombre_completo !== undefined ? { name: datos.nombre_completo } : {}),
        },
      }),
      prisma.nutritionistProfile.upsert({
        where: { userId: sesion.userId },
        update: {
          ...(datos.nombre_completo !== undefined
            ? { nombreCompleto: datos.nombre_completo }
            : {}),
          ...(datos.cedula_profesional !== undefined
            ? { cedulaProfesional: datos.cedula_profesional }
            : {}),
          ...(datos.telefono !== undefined ? { telefono: datos.telefono } : {}),
          ...(datos.especialidad !== undefined ? { especialidad: datos.especialidad } : {}),
          ...(datos.marca_nombre !== undefined ? { marcaNombre: datos.marca_nombre } : {}),
          ...(datos.marca_color !== undefined ? { marcaColor: datos.marca_color } : {}),
          ...(cambioLogo.valorPersistir !== undefined
            ? { marcaLogoUrl: cambioLogo.valorPersistir }
            : {}),
        },
        create: {
          userId: sesion.userId,
          nombreCompleto:
            datos.nombre_completo ?? sesion.sesion.user.name ?? 'Profesional de nutrición',
          cedulaProfesional: datos.cedula_profesional,
          telefono: datos.telefono,
          especialidad: datos.especialidad,
          marcaNombre: datos.marca_nombre,
          marcaColor: datos.marca_color,
          marcaLogoUrl: cambioLogo.valorPersistir,
        },
      }),
    ]);
    cambioLogoPersistido = true;

    if (cambioLogo.urlAnteriorParaBorrar) {
      try {
        await borrarLogoMarca(sesion.userId, cambioLogo.urlAnteriorParaBorrar);
      } catch {
        logger.warn('No se pudo retirar el logo de marca anterior', {
          operation: 'brand-logo-delete-previous',
        });
      }
    }

    const usuario = await prisma.user.findUnique({
      where: { id: sesion.userId },
      select: SELECCION_PERFIL,
    });
    if (!usuario) return notFound('No se encontró la cuenta.');

    return jsonOk(serializarPerfil(usuario));
  } catch (error: unknown) {
    if (!cambioLogoPersistido && cambioLogo.urlNuevaSubida) {
      try {
        await borrarLogoMarca(sesion.userId, cambioLogo.urlNuevaSubida);
      } catch {
        logger.warn('No se pudo limpiar un logo tras fallar la persistencia', {
          operation: 'brand-logo-delete-orphan',
        });
      }
    }
    logger.error('Falló la actualización del perfil', error);
    return internalError();
  }
}
