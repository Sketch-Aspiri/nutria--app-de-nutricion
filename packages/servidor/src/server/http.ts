import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

import { logger } from '@/server/logger';

/**
 * Helpers de respuesta para los handlers de `/api/v1`, según `rules/api-conventions.md`:
 * recurso individual = objeto directo; listado = { data, meta }; error = { error: { code, message, details } }.
 */

export const PER_PAGE_DEFAULT = 20;
export const PER_PAGE_MAX = 100;

/** Códigos de error estables (machine-readable). Los mensajes van en español. */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_BODY: 'INVALID_BODY',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  /** 403: terminó el ciclo de acceso de la cuenta del nutriólogo. */
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  RATE_LIMITED: 'RATE_LIMITED',
  EXPORT_TOO_LARGE: 'EXPORT_TOO_LARGE',
  /** 402: el plan vigente no alcanza para la acción (cupo de pacientes, plantillas). */
  PLAN_LIMIT: 'PLAN_LIMIT',
  /** 409: no hay checkout ni portal que abrir (beta, plan sin precio, sin suscripción). */
  BILLING_NOT_AVAILABLE: 'BILLING_NOT_AVAILABLE',
  /** 503: falta STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET en el servidor. */
  BILLING_NOT_CONFIGURED: 'BILLING_NOT_CONFIGURED',
  /** 422: la petición es correcta, pero el expediente no tiene los datos clínicos. */
  EXPEDIENTE_INCOMPLETO: 'EXPEDIENTE_INCOMPLETO',
  /** 409: el paciente ya tiene cuenta en la app; corresponde recuperar contraseña. */
  PATIENT_ALREADY_LINKED: 'PATIENT_ALREADY_LINKED',
  /** 422: falta correo, consentimiento o el expediente está archivado. */
  PATIENT_NOT_INVITABLE: 'PATIENT_NOT_INVITABLE',
  /** 422: el plan menciona un alérgeno declarado por el paciente. */
  PLAN_ALLERGEN_CONFLICT: 'PLAN_ALLERGEN_CONFLICT',
  /** 422: el plan no tiene energía o contenido suficiente para activarse. */
  PLAN_INCOMPLETE: 'PLAN_INCOMPLETE',
  /** 422: la energía calculada del plan se desvía más de ±5% de la meta. */
  PLAN_ENERGY_OUT_OF_RANGE: 'PLAN_ENERGY_OUT_OF_RANGE',
  /** 409: un plan activo o archivado es histórico y no puede editarse. */
  PLAN_NOT_EDITABLE: 'PLAN_NOT_EDITABLE',
  /** 422: la estructura referencia comidas o items ajenos al plan. */
  PLAN_STRUCTURE_INVALID: 'PLAN_STRUCTURE_INVALID',
  /** 409: otra sesión guardó una versión más reciente del plan. */
  PLAN_VERSION_CONFLICT: 'PLAN_VERSION_CONFLICT',
  /** 503: falta ANTHROPIC_API_KEY en el servidor. */
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  /** 502: el proveedor de IA falló o no respondió. */
  AI_UPSTREAM_ERROR: 'AI_UPSTREAM_ERROR',
  /** 429: se agotó la cuota mensual de generaciones del plan. */
  AI_LIMIT_REACHED: 'AI_LIMIT_REACHED',
  /** 422: la IA respondió, pero su salida no pasó la validación clínica. */
  AI_INVALID_OUTPUT: 'AI_INVALID_OUTPUT',
  /** 422: el documento excede el máximo seguro de comidas o items. */
  PLAN_PDF_TOO_LARGE: 'PLAN_PDF_TOO_LARGE',
  /** 409: el horario se traslapa con otra consulta del mismo nutriólogo. */
  APPOINTMENT_CONFLICT: 'APPOINTMENT_CONFLICT',
  /** 409: la cita ya está cerrada y su estado no admite otra transición. */
  APPOINTMENT_NOT_EDITABLE: 'APPOINTMENT_NOT_EDITABLE',
  /** 422: el paciente no tiene plan activo contra el cual medir adherencia. */
  SIN_PLAN_ACTIVO: 'SIN_PLAN_ACTIVO',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ErrorDetails = Record<string, string[]>;

export type PaginationMeta = {
  page: number;
  per_page: number;
  total: number;
};

/** Recurso individual: se devuelve el objeto tal cual, sin envolver. */
export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonCreated<T>(data: T): NextResponse {
  return jsonOk(data, 201);
}

export function jsonNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Listado paginado: siempre { data, meta }.
 *
 * `meta` es extensible por endpoint —el hilo del paciente añade `sin_leer`—
 * mientras conserve los tres campos de paginación.
 */
export function jsonList<T, M extends PaginationMeta = PaginationMeta>(
  data: T[],
  meta: M,
): NextResponse {
  return NextResponse.json({ data, meta });
}

export function jsonError(
  status: number,
  code: ErrorCodeValue,
  message: string,
  details?: ErrorDetails,
): NextResponse {
  return NextResponse.json(
    { error: details ? { code, message, details } : { code, message } },
    { status },
  );
}

export function unauthenticated(
  message = 'Necesitas iniciar sesión para continuar.',
): NextResponse {
  return jsonError(401, ErrorCode.UNAUTHENTICATED, message);
}

/**
 * Rechaza mutaciones iniciadas desde otro origen cuando el navegador envía
 * `Origin`. Clientes no-browser sin ese header siguen usando la API normal.
 */
export function origenPermitido(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/**
 * 404 también cuando el recurso existe pero es de otro nutriólogo: distinguirlo
 * de un 403 revelaría qué identificadores existen.
 */
export function notFound(message = 'No se encontró el recurso solicitado.'): NextResponse {
  return jsonError(404, ErrorCode.NOT_FOUND, message);
}

export function internalError(): NextResponse {
  return jsonError(
    500,
    ErrorCode.INTERNAL_ERROR,
    'Ocurrió un error inesperado. Intenta de nuevo en unos momentos.',
  );
}

/** Convierte los issues de Zod en `details` sin exponer los valores recibidos. */
export function zodDetails(error: ZodError): ErrorDetails {
  const details: ErrorDetails = {};
  for (const issue of error.issues) {
    const campo = issue.path.length > 0 ? issue.path.join('.') : '_';
    const previos = details[campo] ?? [];
    details[campo] = [...previos, issue.message];
  }
  return details;
}

export function validationError(error: ZodError): NextResponse {
  const details = zodDetails(error);
  // Solo los campos que fallaron, nunca lo que traían: un rechazo del plan o
  // del expediente llevaría peso, notas clínicas o alergias al log. Con esto,
  // un 400 en producción se diagnostica sin pedirle al usuario que reproduzca.
  logger.warn('Validación rechazada', {
    operation: 'validacion',
    code: Object.keys(details).join(', ') || '_',
  });
  return jsonError(
    400,
    ErrorCode.VALIDATION_ERROR,
    'Algunos datos no son válidos. Revisa el formulario.',
    details,
  );
}

/** Lee el body JSON sin lanzar: devuelve `null` si no es JSON válido. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** page/per_page acotados; `per_page` nunca excede PER_PAGE_MAX. */
export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  perPage: number;
  skip: number;
  take: number;
} {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '', 10);
  const rawPerPage = Number.parseInt(searchParams.get('per_page') ?? '', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const perPage =
    Number.isFinite(rawPerPage) && rawPerPage > 0
      ? Math.min(rawPerPage, PER_PAGE_MAX)
      : PER_PAGE_DEFAULT;
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}
