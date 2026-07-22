# Convenciones de API

Backend en Node.js (NestJS) + PostgreSQL. API REST versionada, consumida por `apps/mobile` y `apps/web`.

## Versionado y base URL

- Prefijo de versión en la URL: `https://api.nutricion-app.com/v1/...`.
- Un breaking change (quitar un campo, cambiar su tipo, cambiar el comportamiento de un endpoint) requiere una nueva versión (`/v2`); no se rompen contratos dentro de la misma versión. Agregar campos opcionales nuevos no requiere versión nueva.

## Recursos y rutas

- Rutas en `snake_case` plural, sin verbos: `/v1/meal_entries`, `/v1/nutrition_plans`, `/v1/appointments`.
- Anidamiento solo un nivel cuando el recurso realmente pertenece a otro: `/v1/patients/{patient_id}/meal_entries`. No anidar más de un nivel; para el resto se usa un query param (`/v1/meal_entries?patient_id=...`).
- Verbos HTTP estándar: `GET` (leer), `POST` (crear), `PATCH` (actualizar parcial), `PUT` solo para reemplazo completo (poco uso), `DELETE` (borrar/soft-delete según el recurso).
- Acciones que no mapean a CRUD directo se modelan como sub-recurso, no como verbo en la URL: `POST /v1/appointments/{id}/cancel`, no `POST /v1/cancel_appointment`.

## Formato de request/response

- `Content-Type: application/json` siempre. Fechas en ISO 8601 UTC (`2026-07-21T14:30:00Z`).
- Respuesta de un recurso individual: el objeto directo, sin envolver (`{ "id": "...", "name": "..." }`).
- Respuesta de listado: envuelta con metadata de paginación:

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "per_page": 20, "total": 134 }
}
```

- Paginación por `page`/`per_page` en query params (no cursor-based en el MVP). Máximo `per_page`: 100.
- Nombres de campo en `snake_case` en el body JSON (consistente con la base de datos), aunque el código TypeScript los mapee a `camelCase` internamente.

## Errores

Todo error sigue el mismo formato, independientemente del código HTTP:

```json
{
  "error": {
    "code": "MEAL_ENTRY_INVALID_CALORIES",
    "message": "Las calorías no pueden ser negativas.",
    "details": { "field": "calories" }
  }
}
```

- `code` es estable y machine-readable (para que el frontend pueda reaccionar sin parsear el mensaje). `message` es human-readable, en español, seguro de mostrar al usuario final.
- Códigos HTTP estándar: `400` (validación), `401` (no autenticado), `403` (autenticado pero sin permiso), `404` (no existe o no pertenece al usuario — no se distingue para evitar fugas de información), `409` (conflicto, p.ej. cita duplicada), `422` (regla de negocio violada), `500` (error no esperado, se loggea con detalle en el backend pero nunca se expone el stack trace al cliente).

## Autenticación y autorización

- JWT de acceso (vida corta, ~15 min) + refresh token (vida larga, rotado en cada uso, revocable). El refresh token se guarda en cookie httpOnly en la web y en almacenamiento seguro (`SecureStore`) en mobile.
- Cada request autenticado lleva `Authorization: Bearer <access_token>`.
- Roles: `end_user`, `nutritionist`, `admin`. La autorización se valida siempre en el backend (guards de NestJS) según rol y pertenencia del recurso (un nutricionista solo accede a sus pacientes asignados); nunca se confía en que el frontend oculte una acción como control de seguridad real.

## Rate limiting e idempotencia

- Rate limit por IP + por usuario autenticado en endpoints sensibles (login, creación de citas, webhooks de pago).
- Endpoints de creación que pueden reintentarse desde el cliente (p.ej. registrar una comida offline y sincronizar) aceptan un header `Idempotency-Key` para evitar duplicados.

## Documentación

- Toda la API se documenta con OpenAPI (generado desde decoradores de NestJS), servido en `/v1/docs` en ambientes no productivos. Un endpoint nuevo o modificado no se considera terminado si el spec de OpenAPI no refleja el cambio.

## Webhooks externos

- Webhooks de Stripe (pagos) y del proveedor de push verifican firma/secreto antes de procesar, y son idempotentes (un mismo evento reenviado no debe duplicar efectos).
