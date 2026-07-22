import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

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
  RATE_LIMITED: 'RATE_LIMITED',
  PLAN_LIMIT: 'PLAN_LIMIT',
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

/** Listado paginado: siempre { data, meta }. */
export function jsonList<T>(data: T[], meta: PaginationMeta): NextResponse {
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
  return jsonError(
    400,
    ErrorCode.VALIDATION_ERROR,
    'Algunos datos no son válidos. Revisa el formulario.',
    zodDetails(error),
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
