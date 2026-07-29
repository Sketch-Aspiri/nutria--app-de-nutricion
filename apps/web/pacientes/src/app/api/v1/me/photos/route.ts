import { requierePaciente } from '@/server/auth/guards';
import { ErrorCode, internalError, jsonCreated, jsonError } from '@/server/http';
import { logger } from '@/server/logger';
import { MAX_FOTO_BYTES, subirFotoComida } from '@/server/me/fotos';
import { limiteDeFotos } from '@/server/me/limites';

export const dynamic = 'force-dynamic';

const MB = (bytes: number) => Math.round(bytes / (1024 * 1024));

/**
 * POST /api/v1/me/photos — sube una foto de comida y devuelve su URL.
 *
 * Recibe `multipart/form-data` con el campo `foto`, que es lo que produce un
 * `<input type="file" capture>` sin trabajo extra en el cliente. La URL que
 * devuelve es la que luego viaja en `meal_logs.foto_url`.
 *
 * El formato se decide por los bytes, no por el `Content-Type` declarado: un
 * SVG con script servido desde el dominio del blob sería un XSS almacenado.
 */
export async function POST(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const limite = await limiteDeFotos(sesion.userId);
  if (!limite.permitido) return limite.respuesta;

  let archivo: unknown;
  try {
    archivo = (await request.formData()).get('foto');
  } catch {
    return jsonError(
      400,
      ErrorCode.INVALID_BODY,
      'Envía la foto como multipart/form-data en el campo "foto".',
    );
  }

  if (!(archivo instanceof File)) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'Falta el archivo de la foto.');
  }
  // Se corta por el tamaño declarado antes de leer el cuerpo entero en memoria.
  if (archivo.size > MAX_FOTO_BYTES) {
    return jsonError(
      413,
      ErrorCode.VALIDATION_ERROR,
      `La foto no puede pesar más de ${MB(MAX_FOTO_BYTES)} MB.`,
    );
  }

  try {
    const bytes = Buffer.from(await archivo.arrayBuffer());
    const resultado = await subirFotoComida(sesion.patientId, bytes);

    if (!resultado.ok) {
      switch (resultado.motivo) {
        case 'vacia':
          return jsonError(400, ErrorCode.VALIDATION_ERROR, 'La foto llegó vacía.');
        case 'muy_grande':
          return jsonError(
            413,
            ErrorCode.VALIDATION_ERROR,
            `La foto no puede pesar más de ${MB(MAX_FOTO_BYTES)} MB.`,
          );
        case 'formato_no_soportado':
          return jsonError(
            422,
            ErrorCode.VALIDATION_ERROR,
            'Solo se admiten fotos JPG, PNG o WebP.',
          );
        case 'almacenamiento':
          return jsonError(
            503,
            ErrorCode.INTERNAL_ERROR,
            'No pudimos guardar la foto. Intenta de nuevo en unos momentos.',
          );
      }
    }

    return jsonCreated({ foto_url: resultado.url });
  } catch (error: unknown) {
    logger.error('Falló la subida de una foto de comida', error);
    return internalError();
  }
}
