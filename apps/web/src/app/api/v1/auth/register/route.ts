import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { hashPassword, normalizarEmail, passwordSchema } from '@/server/auth/password';
import { asegurarCuentaNutriologo } from '@/server/auth/provisioning';
import { crearTokenVerificacion } from '@/server/auth/tokens';
import { prisma } from '@/server/db';
import { enviarVerificacionEmail } from '@/server/email';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { ipDe, rateLimit } from '@/server/rate-limit';

const MAX_ALTAS_POR_IP = 5;
const VENTANA_MS = 60 * 60 * 1000;

const registroSchema = z.object({
  nombre_completo: z.string().trim().min(3, 'Escribe tu nombre completo.').max(120),
  email: z.email('El correo no tiene un formato válido.'),
  password: passwordSchema,
  cedula_profesional: z.string().trim().max(30).optional(),
  acepta_aviso_privacidad: z.literal(true, {
    message: 'Debes aceptar el aviso de privacidad para crear la cuenta.',
  }),
});

/** POST /api/v1/auth/register — alta de una cuenta de nutriólogo. */
export async function POST(request: Request) {
  const limite = rateLimit(`register:${ipDe(request)}`, MAX_ALTAS_POR_IP, VENTANA_MS);
  if (!limite.permitido) {
    return jsonError(
      429,
      ErrorCode.RATE_LIMITED,
      'Demasiados intentos de registro. Espera unos minutos antes de reintentar.',
    );
  }

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = registroSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const email = normalizarEmail(parsed.data.email);
  const passwordHash = await hashPassword(parsed.data.password);

  let usuarioId: string;
  try {
    const usuario = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: parsed.data.nombre_completo,
        role: 'NUTRITIONIST',
      },
      select: { id: true },
    });
    usuarioId = usuario.id;
  } catch (error: unknown) {
    // P2002: violación de índice único sobre el correo.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return jsonError(
        409,
        ErrorCode.EMAIL_TAKEN,
        'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
      );
    }
    logger.error('Falló el alta de usuario', error);
    return internalError();
  }

  try {
    await asegurarCuentaNutriologo(usuarioId, parsed.data.nombre_completo);
    if (parsed.data.cedula_profesional) {
      await prisma.nutritionistProfile.update({
        where: { userId: usuarioId },
        data: { cedulaProfesional: parsed.data.cedula_profesional },
      });
    }
  } catch (error: unknown) {
    logger.error('Falló el provisionamiento de la cuenta', error);
    return internalError();
  }

  const token = await crearTokenVerificacion(usuarioId);
  const envio = await enviarVerificacionEmail(email, token);

  return jsonCreated({
    id: usuarioId,
    email,
    verificacion_enviada: envio.enviado,
    // Solo en desarrollo sin proveedor de correo configurado.
    enlace_verificacion_dev: envio.enviado ? undefined : envio.enlaceDev,
  });
}
