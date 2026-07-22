# Plan V2 — nutria web: de demo a producto desplegado y usable por nutriólogos reales

> Documento de planeación de la segunda versión de la app web (panel del nutriólogo).
> Objetivo: pasar del MVP demo (estado en `localStorage`, datos simulados) a una plataforma
> completamente funcional, desplegada en Vercel, con base de datos real, autenticación,
> fórmulas clínicas completas, base de alimentos profesional estilo SMAE con imágenes,
> IA de Claude por API, y suscripciones con Stripe — lista para que nutriólogos reales la prueben.

---

## 1. Diagnóstico de la V1 (estado actual)

### Lo que ya existe y se conserva

| Pieza | Estado | Se reutiliza en V2 |
|---|---|---|
| `apps/web` — Next.js 15 App Router, React 19, Tailwind | UI completa del panel: pacientes, wizard 4 pasos, detalle con 5 tabs, agenda, mensajes, facturación, plantillas, marca blanca | Sí — es la base visual de la V2 |
| `packages/shared/src/nutricion.ts` | Mifflin-St Jeor real, factores de actividad, ajuste por objetivo, distribución de macros. Con tests | Sí — se amplía con más fórmulas |
| `packages/shared/src/alergias.ts`, `adherencia.ts`, `ia.ts` | Lógica pura con tests | Sí |
| `packages/shared/src/alimentos.ts` | Solo **20 alimentos** hardcodeados, sin micronutrientes ni imágenes | Se reemplaza por BD real (sección 5) |
| `apps/web/src/app/api/ai/route.ts` | Proxy a Anthropic funcional, key en servidor, errores conforme a `api-conventions.md` | Sí — se evoluciona (sección 8) |
| `packages/ui-tokens` | Design tokens compartidos | Sí |

### Lo que es fachada y debe reemplazarse

- **Login simulado**: `login()` solo cambia un booleano en `localStorage`. No hay usuarios, ni sesiones, ni roles.
- **Todo el estado vive en `localStorage`** (`src/store/app-state.tsx` + `datos-demo.ts`): pacientes, citas, mensajes, facturas, plantillas. Se pierde al cambiar de navegador; no hay multiusuario.
- **No existe `apps/api`**: el backend NestJS descrito en `CLAUDE.md` nunca se construyó.
- **Facturación**: solo marca flags `pagada`/`cfdi` en memoria. No hay cobro real.
- **Mensajes**: chat local sin transporte; el "cifrado extremo a extremo" es solo copy.
- **Base de alimentos**: 20 registros con 4 macros; sin porciones múltiples, micronutrientes, imágenes ni sistema de equivalentes.
- **Suscripción Pro**: modal decorativo, sin pasarela de pago.
- **PDF con marca blanca**: vista previa HTML, sin generación real de PDF.

---

## 2. Decisión de arquitectura V2

**Recomendación: Next.js full-stack desplegado 100 % en Vercel.**

El requisito rector es "todo desplegado en Vercel para empezar a probar". Levantar el NestJS
separado (Railway + Docker, como describe `skills/deploy/deploy-config.md`) agrega una segunda
plataforma, pipeline y facturación sin beneficio para esta etapa. La V2 usa:

- **Next.js 15 App Router** como frontend **y** backend (Route Handlers bajo `/api/v1/*` + Server Actions donde convenga).
- **PostgreSQL gestionado**: **Neon** (integración nativa Vercel↔Neon, branching de BD por preview deploy). Alternativa equivalente: Vercel Postgres o Supabase.
- **Prisma** como ORM (decisión ya contemplada en `CLAUDE.md`: "Prisma/TypeORM"), con migraciones versionadas.
- **Auth.js (NextAuth v5)** para autenticación (credenciales + Google), sesión JWT, roles.
- **Vercel Blob** para imágenes (alimentos, fotos de pacientes, logos de marca blanca).
- **Stripe** para suscripciones (sección 9).
- **Sentry** para errores (ya previsto en `deploy-config.md`).

Reglas que se mantienen del proyecto:
- Los handlers `/api/v1/*` siguen `rules/api-conventions.md` al pie: rutas `snake_case` plural, respuestas `{ data, meta }` en listados, errores `{ error: { code, message, details } }`, paginación `page`/`per_page`, fechas ISO 8601 UTC. Así, si más adelante se extrae un NestJS dedicado, los clientes no cambian.
- Toda la lógica de negocio pura (fórmulas, equivalentes, adherencia, validación de alergias) sigue viviendo en `packages/shared` — el backend la importa, no la duplica.
- Autorización **siempre** en el servidor: cada query de Prisma se filtra por `nutritionist_id` de la sesión. Ocultar botones no es control de seguridad.

Estructura resultante:

```
apps/web/
  prisma/schema.prisma + migrations/ + seed/
  src/app/api/v1/...        # API REST real
  src/app/api/webhooks/stripe/route.ts
  src/server/               # servicios: auth, db, stripe, ai, pdf, storage
  src/services/             # clientes React Query por recurso (reemplaza al store)
packages/shared/            # fórmulas ampliadas + tipos de dominio (fuente de verdad)
```

---

## 3. Modelo de datos (Prisma / PostgreSQL)

Esquema completo — nombres de tablas/columnas en `snake_case` (convención del repo). Todas las
tablas llevan `id` (uuid), `created_at`, `updated_at`; borrado lógico con `deleted_at` donde aplica.

### Identidad y cuentas

- **users** — `email` (único, citext), `password_hash` (nullable si es OAuth), `role` (`nutritionist` | `admin` | `end_user`), `email_verified_at`, `last_login_at`.
- **nutritionist_profiles** — 1:1 con users: `nombre_completo`, `cedula_profesional`, `telefono`, `especialidad`, `bio`. Marca blanca: `marca_nombre`, `marca_color`, `marca_logo_url`.
- **subscriptions** — `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan` (`free` | `pro` | `clinica`), `status` (`active`|`trialing`|`past_due`|`canceled`), `current_period_end`, `cancel_at_period_end`.
- **ai_usage** — `user_id`, `mes` (YYYY-MM), `generaciones`, `tokens_entrada`, `tokens_salida`. Para el límite mensual por plan.

### Pacientes y expediente clínico

- **patients** — `nutritionist_id` (FK, índice: es el filtro de autorización), `nombre`, `fecha_nacimiento`, `genero`, `email`, `telefono`, `foto_url`, `estado` (`activo`|`archivado`), `user_id` nullable (se llena cuando el paciente crea cuenta en la app móvil).
- **medical_records** — 1:1 paciente: `condiciones` (jsonb), `antecedentes`, `medicamentos`, `nivel_actividad`, `objetivo`. Campos de texto clínico cifrados a nivel de aplicación (sección 11).
- **anthropometry_measurements** — histórico (no 1:1): `patient_id`, `fecha`, `peso_kg`, `altura_cm`, `cintura_cm`, `cadera_cm`, `grasa_pct`, `musculo_pct`, `pliegues` (jsonb: tricipital, bicipital, subescapular, suprailiaco — para Durnin-Womersley).
- **food_preferences** — 1:1 paciente: `tipo_dieta`, `alergias` (jsonb), `disgustos`, `comidas_por_dia`, `presupuesto_tiempo`.
- **consultation_notes** — `patient_id`, `fecha`, `motivo`, `hallazgos`, `plan`, `seguimiento`, `transcripcion_url` nullable, `origen` (`manual`|`ia_transcripcion`). Cifradas.

### Nutrición

- **foods** — la base de alimentos profesional (detalle en sección 5): `nombre`, `nombre_normalizado` (para búsqueda), `grupo_smae`, `subgrupo`, `porcion_descripcion`, `porcion_gramos`, `energia_kcal`, `proteina_g`, `lipidos_g`, `saturadas_g`, `colesterol_mg`, `carbohidratos_g`, `fibra_g`, `azucar_g`, `sodio_mg`, `potasio_mg`, `calcio_mg`, `hierro_mg`, `acido_folico_ug`, `vitamina_a_ug`, `vitamina_c_mg`, `indice_glicemico` nullable, `equivalentes` (jsonb — a cuántos equivalentes SMAE corresponde la porción), `imagen_url`, `fuente` (`incmnsz`|`usda`|`off`|`propia`), `es_publico` bool, `nutritionist_id` nullable (alimentos propios del nutriólogo).
- **meal_plans** — `patient_id`, `estado` (`borrador`|`activo`|`archivado`), `calorias_diarias`, `proteina_g`, `carbos_g`, `grasa_g`, `nota`, `origen` (`manual`|`ia`|`plantilla`), `compartido_at`, `pdf_url`.
- **meal_plan_meals** — `meal_plan_id`, `orden`, `nombre` (Desayuno…), `horario`, `descripcion`.
- **meal_plan_items** — `meal_id`, `food_id` nullable (o texto libre `descripcion_libre`), `cantidad_porciones`, snapshot de macros al momento (los alimentos pueden editarse después).
- **plan_templates** — `nutritionist_id`, `nombre`, `objetivo`, `calorias`, `estructura` (jsonb con comidas/items).
- **recipes** — `nutritionist_id`, `patient_id` nullable, `nombre`, `ingredientes` (jsonb), `pasos`, `calorias`, `porciones`, `origen` (`manual`|`ia`), `estado` (`sugerida`|`enviada`|`en_curso`).

### Seguimiento (alimenta y consume la app móvil)

- **meal_logs** — `patient_id`, `fecha`, `nombre`, `foto_url`, `comentario_paciente`, `comentario_nutriologo`, `meal_plan_meal_id` nullable (check contra el plan).
- **weight_logs** — `patient_id`, `fecha`, `peso_kg` (la adherencia y la gráfica salen de aquí + anthropometry).
- **exercise_logs** — `patient_id`, `fecha`, `tipo`, `duracion_min`.
- **activity_plans** — `patient_id`, `texto`, `origen`, `compartido_at`.
- La **adherencia y racha se calculan** con `packages/shared/src/adherencia.ts` sobre `meal_logs` vs plan activo — no se almacenan como columnas editables.

### Agenda, mensajes y cobro

- **appointments** — `nutritionist_id`, `patient_id`, `inicio` (timestamptz), `duracion_min`, `tipo` (`presencial`|`videollamada`), `estado` (`programada`|`completada`|`cancelada`|`no_asistio`), `recordatorio_enviado_at`, `video_url` nullable.
- **messages** — `nutritionist_id`, `patient_id`, `emisor` (`nutritionist`|`patient`), `texto` (cifrado), `leido_at`. V2 usa polling con React Query (30 s); tiempo real (Pusher/Ably) queda para V2.1.
- **invoices** — `nutritionist_id`, `patient_id`, `concepto`, `monto_centavos`, `moneda` (`MXN`), `estado` (`pendiente`|`pagada`|`cancelada`), `pagada_at`, `metodo`, `requiere_cfdi`, `cfdi_status`. (Esto es el cobro del nutriólogo a SUS pacientes; la suscripción del nutriólogo a nutria es Stripe, sección 9 — son dos flujos distintos.)
- **audit_logs** — `user_id`, `accion`, `recurso`, `recurso_id`, `ip`, `metadata` (jsonb sin datos de salud). Obligatorio para expedientes (NOM-004 / LFPDPPP).

---

## 4. Fórmulas clínicas reales (`packages/shared`)

Se amplía `nutricion.ts` a un módulo `nutricion/` con funciones puras, todas con tests (cobertura ≥ 80 % como exige `rules/testing.md`), verificadas contra las referencias que usan los nutriólogos en México (Suverza & Haua, *El ABCD de la evaluación del estado de nutrición*; posiciones de la AMMFEN):

| Función | Fórmula | Notas |
|---|---|---|
| `calcularTDEE` (ya existe) | **Mifflin-St Jeor** (default) | Se mantiene; se agrega selector de ecuación |
| `bmrHarrisBenedict` | Harris-Benedict **revisada (Roza-Shizgal 1984)** | Muy usada en consulta en México |
| `bmrFaoOms` | FAO/OMS/UNU 2001 por rangos de edad y sexo | Requerida en ámbito institucional |
| `bmrKatchMcArdle` | 370 + 21.6 × masa magra | Solo si hay `grasa_pct` medido |
| `imc` + `clasificarImc` | peso/talla² con cortes OMS y cortes para población mexicana (NOM-008) | |
| `indiceCinturaCadera`, `indiceCinturaTalla` | Con cortes de riesgo cardiometabólico por sexo | |
| `grasaCorporalDurninWomersley` | 4 pliegues → densidad → **Siri** | Usa el jsonb `pliegues` |
| `pesoIdeal` | Fórmulas de referencia + rango de peso saludable por IMC | |
| `pesoAjustado` | Para obesidad (factor 0.25) — insumo correcto del GET en IMC ≥ 30 | |
| `requerimientoProteina` | g/kg según objetivo/condición (0.8–2.2), con tope clínico | Reemplaza el % fijo cuando el nutriólogo lo prefiera |
| `requerimientoAgua` | 30–35 ml/kg ajustado por actividad | Alimenta la meta de agua de la app móvil |
| `distribuirEquivalentes` | Reparte las kcal objetivo en **equivalentes SMAE** por grupo (verduras, frutas, cereales, leguminosas, origen animal, leche, grasas, azúcares) | El corazón del flujo profesional mexicano: el nutriólogo trabaja por equivalentes, no solo por macros |

Reglas: cada función lanza `EXPEDIENTE_INCOMPLETO` ante datos faltantes (patrón ya existente), nunca inventa defaults clínicos silenciosos. La UI de `TabCalculo` gana: selector de ecuación, comparativa entre ecuaciones, panel de equivalentes por grupo, y todo el cálculo queda guardado como snapshot en el plan (auditable).

---

## 5. Base de datos de alimentos profesional (estilo SMAE, con imágenes)

### Restricción legal que define la estrategia

El **SMAE** (*Sistema Mexicano de Alimentos Equivalentes*, Pérez Lizaur et al.) es una obra
comercial con derechos de autor: **no se puede copiar su tabla íntegra**. Lo que sí se puede:
usar su **metodología pública** (grupos de equivalentes y aportes promedio por grupo, que
provienen de la norma y literatura abierta) y poblar los valores nutrimentales desde fuentes
abiertas. Este plan construye una base *compatible con la práctica SMAE* sin infringir la obra.

### Fuentes de datos (por prioridad)

1. **USDA FoodData Central** (dominio público, API gratuita) — valores nutrimentales completos; existen entradas para la mayoría de alimentos consumidos en México.
2. **Open Food Facts** (licencia abierta ODbL) — productos empaquetados mexicanos con código de barras, fotos incluidas.
3. **Tablas INCMNSZ / INSP de composición de alimentos mexicanos** — para alimentos típicos (nopal, tortilla, frijol, guisos): se usan como referencia de verificación y se capturan manualmente los ~150 alimentos mexicanos núcleo (los hechos nutrimentales no son sujetos de copyright; no se reproduce la maquetación ni la obra completa).
4. **Alimentos propios del nutriólogo**: CRUD para que cada profesional agregue alimentos/preparaciones con sus valores (campo `nutritionist_id`).

### Estructura y alcance

- **Meta V2: ~800–1,000 alimentos** curados en 3 tandas de seed: (1) 150 núcleo mexicano capturado a mano y verificado, (2) ~500 importados de USDA con script de mapeo/traducción, (3) ~300 empaquetados de Open Food Facts.
- Cada alimento con la **ficha completa** (sección 3: energía, macros, saturadas, colesterol, fibra, azúcares, sodio, potasio, calcio, hierro, folato, vit. A/C) + **porción en gramos y en medida casera** ("1 pieza", "1/2 taza") + **equivalentes SMAE** (ej. tortilla = 1 eq. de cereal).
- **Búsqueda**: columna `nombre_normalizado` sin acentos + índice `pg_trgm` para búsqueda difusa ("jitomate" ≈ "tomate"); filtro por grupo; alimentos del nutriólogo primero.

### Imágenes

- Almacenadas en **Vercel Blob**, servidas vía `next/image` (tamaños 96px lista / 400px ficha, WebP).
- Fuentes por prioridad: fotos de Open Food Facts (ODbL, con atribución) para empaquetados; **Wikimedia Commons** (CC) para alimentos frescos; para huecos, set propio de ilustraciones consistentes generadas por lote (estilo flat, mismo fondo) — evita el collage de fotos con licencias dudosas.
- Pipeline de seed: script `prisma/seed/` descarga → recorta/convierte (sharp) → sube a Blob → guarda `imagen_url`. Fallback UI: ilustración genérica del grupo SMAE.

---

## 6. Autenticación y usuarios

- **Auth.js (NextAuth v5)** con: Credentials (email + password, hash argon2), Google OAuth, verificación de email (Resend, 100 correos/día gratis) y recuperación de contraseña.
- Sesión JWT (estrategia `jwt`) con `role` y `userId` en el token; middleware de Next protege `(panel)`; cada handler `/api/v1` revalida sesión + rol en servidor (nunca solo middleware).
- Registro público **solo de nutriólogos** (con campo cédula profesional, verificación manual en V2.1). Pacientes se crean desde el panel; su acceso a la app móvil se activa por invitación (token por email) que liga `patients.user_id`.
- Rate limiting en login/registro/IA con `@upstash/ratelimit` (Redis serverless, capa gratuita).
- El rol `admin` (soporte interno): listado de nutriólogos, métricas, gestión de suscripciones. Panel mínimo en `/admin`.

---

## 7. API REST `/api/v1` (contrato completo)

Conforme a `rules/api-conventions.md`. Recursos y endpoints principales:

```
POST   /api/v1/auth/register | login | refresh | logout | verify_email | forgot_password
GET    /api/v1/me                       PATCH /api/v1/me            # perfil + marca blanca
GET|POST /api/v1/patients               GET|PATCH|DELETE /api/v1/patients/{id}
GET|POST /api/v1/patients/{id}/measurements                        # antropometría histórica
GET|PATCH /api/v1/patients/{id}/medical_record | food_preferences
GET|POST /api/v1/patients/{id}/consultation_notes
POST   /api/v1/patients/{id}/calculations                          # ejecuta fórmulas, guarda snapshot
GET|POST /api/v1/patients/{id}/meal_plans   PATCH /api/v1/meal_plans/{id}
POST   /api/v1/meal_plans/{id}/share | export_pdf | duplicate
GET    /api/v1/patients/{id}/meal_logs | weight_logs | exercise_logs | adherence
GET|POST /api/v1/foods                  GET|PATCH|DELETE /api/v1/foods/{id}   # ?query=&grupo=&page=
GET|POST /api/v1/plan_templates | recipes | appointments | invoices
POST   /api/v1/appointments/{id}/cancel | complete
GET|POST /api/v1/patients/{id}/messages
POST   /api/v1/ai/generate              # sección 8
GET    /api/v1/billing/subscription     POST /api/v1/billing/checkout | portal
POST   /api/webhooks/stripe
GET    /api/v1/health
```

- Listados con `{ data, meta: { page, per_page, total } }`, `per_page` máx. 100.
- 404 (no 403) cuando el recurso existe pero no pertenece al nutriólogo — evita fugas de existencia.
- `Idempotency-Key` aceptado en POST de citas, facturas y meal_logs (reintentos móviles).
- OpenAPI generado con `zod-openapi` a partir de los schemas de validación Zod de cada handler, servido en `/api/v1/docs` fuera de producción.
- Los mismos endpoints sirven a la app móvil (React Query en ambos clientes) — el contrato es compartido.

---

## 8. Integración de IA (Claude API)

### Arquitectura

- Un solo endpoint interno `POST /api/v1/ai/generate` con `tipo` discriminado; el route handler actual (`api/ai/route.ts`) se migra a `src/server/ai/` como servicio.
- SDK oficial `@anthropic-ai/sdk`. Modelos por tarea:
  - **claude-sonnet-5**: generación de borrador de plan, recetas, resumen clínico de notas (calidad clínica).
  - **claude-haiku-4-5**: sugerencia de respuesta en chat, títulos, tareas ligeras (costo bajo, latencia baja).
- **Streaming SSE** hacia la UI en generaciones largas (plan, recetas) — percepción de velocidad clave para la prueba con usuarios reales.
- **Tool use / salida estructurada**: el borrador de plan se pide como JSON con schema (comidas, horarios, food_ids sugeridos de la BD real + gramajes), se valida con Zod, se verifica contra alergias del paciente con `packages/shared/alergias.ts` y contra las kcal objetivo (±5 %) **antes** de mostrarse. Si no valida, se reintenta una vez y luego se degrada a texto editable.

### Casos de uso V2 (todos asistivos: la IA propone, el nutriólogo aprueba — restricción de CLAUDE.md)

1. **Borrador de plan alimenticio** anclado al cálculo (kcal, macros, equivalentes, preferencias, alergias) y a la BD de alimentos real.
2. **Resumen clínico estructurado** de la nota de consulta (motivo/hallazgos/plan/seguimiento) — ya prototipado en `useNotaClinica.ts`.
3. **Recetas** con ingredientes de la BD y ajuste calórico.
4. **Sugerencia de respuesta** en mensajes.
5. **Sugerencia de plan de actividad**.
6. **Transcripción de consulta**: V2 usa Web Speech API del navegador (gratis) para dictado; transcripción de audio grabado (Whisper/Deepgram) queda para V2.1.

### Privacidad y control de costos

- Prompts con datos de salud: **nunca se loggean** (regla existente); a Anthropic se envían datos **seudonimizados** (edad/sexo/mediciones sí; nombre/email/teléfono se sustituyen por placeholders antes de armar el prompt).
- Cada llamada registra en `ai_usage` tokens y tipo. **Límites por plan**: Free 15 generaciones/mes, Pro 150, Clínica 500. Al llegar al límite: error `AI_LIMIT_REACHED` + CTA de upgrade.
- Presupuesto estimado con Sonnet (plan ~3k tokens in / 1.5k out): < $0.10 USD por generación → margen holgado en el plan Pro de $499 MXN.
- `max_tokens` acotado por tipo de tarea; retry con backoff solo en 429/529.

---

## 9. Suscripciones y facturación con Stripe

### Planes

| Plan | Precio | Incluye |
|---|---|---|
| **Free** | $0 | 3 pacientes activos, 15 generaciones IA/mes, sin PDF marca blanca |
| **Pro** | $499 MXN/mes o $4,990 MXN/año | Pacientes ilimitados, 150 IA/mes, PDF marca blanca, plantillas ilimitadas |
| **Clínica** | $1,299 MXN/mes | 3 asientos de nutriólogo, 500 IA/mes compartidas (V2 lo deja definido en Stripe; multi-asiento real en V2.1) |

### Implementación

1. Productos/precios creados en Stripe (MXN, IVA con **Stripe Tax** activado), `price_id`s en variables de entorno.
2. **Stripe Checkout** (modo subscription, con `trial_period_days: 14` en Pro) desde `POST /api/v1/billing/checkout`; `customer` ligado a `users.id` vía `metadata` + `subscriptions.stripe_customer_id`.
3. **Customer Portal** de Stripe para cambiar plan/tarjeta/cancelar (`POST /api/v1/billing/portal`) — cero UI propia de gestión de tarjetas.
4. **Webhook** `/api/webhooks/stripe` (verificación de firma, idempotente por `event.id`): `checkout.session.completed`, `customer.subscription.updated|deleted`, `invoice.paid`, `invoice.payment_failed` → actualizan `subscriptions`. Es la **única** fuente de verdad del plan.
5. **Gate de features** en servidor: helper `getEntitlements(userId)` consultado por los handlers (crear paciente #4 en Free → `402 PLAN_LIMIT`; IA → límite de `ai_usage`). Nunca solo en el frontend.
6. Modo test end-to-end con tarjetas de prueba + `stripe listen` local; en Vercel, webhook apuntando al dominio de producción y otro endpoint de test en preview.
7. **CFDI** (factura fiscal mexicana de la suscripción): V2 emite recibos de Stripe; timbrado CFDI 4.0 vía Facturapi queda para V2.1 (documentado como decisión). El módulo `invoices` (cobros del nutriólogo a sus pacientes) permanece como registro manual de cobros en V2; cobro con link de pago Stripe Connect es V3.

---

## 10. Flujos E2E (Playwright) — definición de "funcional"

La V2 se considera lista cuando estos journeys pasan en CI contra un preview deploy (regla de
`rules/testing.md`: Playwright en cada PR). Un spec por flujo, datos por factories + BD de branch Neon:

1. **Onboarding nutriólogo**: registro → verificación email → completa perfil/marca → llega al panel vacío con checklist de inicio.
2. **Alta de paciente completa**: wizard 4 pasos → paciente visible en lista → expediente persiste tras recargar y en otro navegador (BD real, no localStorage).
3. **Cálculo clínico**: capturar antropometría → elegir ecuación → ver BMR/TDEE/macros/equivalentes correctos (asserts contra `packages/shared` con valores de referencia publicados).
4. **Plan con IA**: generar borrador → validar que respeta kcal ±5 % y bloquea alérgenos → editar comida (buscar alimento real con imagen en el picker) → activar plan → exportar PDF con logo del nutriólogo → compartir.
5. **Seguimiento**: sembrar meal_logs del paciente → panel muestra adherencia/racha correctas → nutriólogo comenta una comida.
6. **Agenda**: crear cita → aparece en la vista semanal → cancelarla → estado correcto (+ recordatorio por email vía cron, assert sobre outbox de test).
7. **Mensajes**: enviar mensaje → aparece para el paciente (segunda sesión) → sugerencia IA de respuesta.
8. **Suscripción**: Free llega al límite de 3 pacientes → paywall → checkout Stripe test → webhook actualiza a Pro → el límite desaparece; cancelación → vuelve a Free al fin del periodo.
9. **Aislamiento de datos (seguridad)**: nutriólogo B no puede ver/editar pacientes de A ni por URL directa ni por API (espera 404).
10. **Límite de IA**: agotar cuota → `AI_LIMIT_REACHED` + CTA upgrade.

Además: tests unitarios/integración de handlers con la BD (≥ 80 % en `src/server` y `packages/shared`, 60 % global web), y smoke test de la app en móvil-viewport.

---

## 11. Seguridad y cumplimiento (datos de salud)

- **Cifrado en aplicación** (AES-256-GCM, key en env, helper `src/server/crypto.ts`) para columnas sensibles: notas de consulta, antecedentes, medicamentos, mensajes. Neon cifra en reposo, pero estas columnas quedan además ilegibles ante acceso directo a BD.
- **Nunca loggear datos de salud** (regla del repo): logger con allowlist de campos; Sentry con `beforeSend` que remueve bodies.
- **LFPDPPP**: aviso de privacidad en registro, consentimiento explícito del paciente (checkbox al alta + email), endpoints de exportación (`GET /api/v1/patients/{id}/export` → JSON/PDF del expediente) y eliminación definitiva (derechos ARCO).
- **NOM-004-SSA3** (expediente clínico): notas con fecha/hora inmutables una vez firmadas (append-only + `audit_logs`).
- Cabeceras de seguridad en `next.config` (CSP, HSTS), cookies `httpOnly/secure/samesite`, validación Zod en todos los inputs, `npm audit` en CI.
- Auditoría previa al lanzamiento con el agente `security-auditor` del repo (checklist de roles y fuga de datos), enfocada en los handlers de `patients/*`.

---

## 12. Despliegue en Vercel

1. **Proyecto Vercel** apuntando a `apps/web` (monorepo: `Root Directory = apps/web`, install en raíz con workspaces).
2. **Neon** vía integración nativa: `DATABASE_URL` inyectada por ambiente; **branch de BD por preview deploy** (cada PR prueba contra su propia copia + seed).
3. **Variables por ambiente** (Production/Preview/Development): `DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `UPSTASH_REDIS_*`, `ENCRYPTION_KEY`, `SENTRY_DSN`. `.env.example` actualizado sin valores.
4. **Migraciones**: `prisma migrate deploy` como paso de build (o GitHub Action previa al deploy de producción). Regla del repo: migraciones reversibles / expand-contract.
5. **Vercel Cron**: recordatorios de citas (cada 15 min), reset mensual de `ai_usage`, resumen semanal por email al nutriólogo.
6. **CI (GitHub Actions)**: PR → lint + type-check + unit/integration + Playwright contra el preview; `main` → producción tras checks (flujo de `deploy-config.md`, con Vercel en lugar de Railway para esta etapa).
7. **Sentry** (web + server) y analytics de Vercel. Alertas: error rate, fallos de webhook Stripe, health check `/api/v1/health`.
8. Dominio: `app.<dominio>.mx` en producción; previews con protección por password de Vercel (datos de prueba, no reales, en previews).

---

## 13. Fases de implementación (8 semanas estimadas)

| Fase | Semana | Entregable (criterio de aceptación) |
|---|---|---|
| **0. Fundaciones** ✅ | 1 | Prisma + Neon conectados; schema completo migrado; Auth.js con registro/login/verificación; middleware de sesión; CI corriendo |
| **1. Pacientes reales** | 2 | CRUD pacientes + expediente + antropometría contra BD; wizard conectado; el store `localStorage` eliminado de estas vistas; E2E #2 y #9 en verde |
| **2. Fórmulas + cálculo** | 3 | Módulo `nutricion/` ampliado con tests; TabCalculo con selector de ecuación y equivalentes; snapshot persistido; E2E #3 |
| **3. Base de alimentos** | 3–4 | Seed tanda 1 (150 núcleo MX) + tanda 2 (USDA); imágenes en Blob; búsqueda pg_trgm; FoodPicker contra API; CRUD alimentos propios |
| **4. Planes + PDF + plantillas** | 4–5 | Editor de plan sobre BD con items ligados a foods; plantillas; PDF real (react-pdf) con marca blanca; E2E #4 |
| **5. IA Claude** | 5 | Servicio AI con streaming, salida estructurada validada, seudonimización, `ai_usage` y límites; los 5 casos de uso; E2E #10 |
| **6. Agenda, mensajes, seguimiento** | 6 | Citas + recordatorios (cron + Resend); mensajes con polling; seguimiento leyendo logs reales; E2E #5, #6, #7 |
| **7. Stripe** | 7 | Checkout, portal, webhooks, entitlements en servidor; paywall; E2E #8 |
| **8. Endurecimiento y lanzamiento** | 8 | Cifrado de columnas, auditoría security-auditor, Sentry, avisos de privacidad, seed tanda 3, carga de prueba, dominio productivo, **onboarding de 3–5 nutriólogos piloto** |

Cada fase = un PR enfocado (regla del repo: cambios pequeños), con `/code-review` antes de merge.

---

---

## 13-bis. Bitácora de ejecución

### Fase 0 — Fundaciones (completada)

Construido en `apps/web`:

- **Base de datos**: `prisma/schema.prisma` con las 28 tablas y 15 enums de la sección 3, y la
  migración base en `prisma/migrations/0_init/migration.sql`. Cliente único en `src/server/db.ts`
  (log restringido a errores: el log de queries expondría datos clínicos).
- **Autenticación** (`src/server/auth/`): Auth.js v5 con sesión JWT de 8 h. `config.ts` es
  edge-safe y contiene las reglas de acceso; `index.ts` agrega el adaptador de Prisma y el
  proveedor de credenciales. Alta con contraseña, acceso con Google (opcional) y verificación
  de correo con tokens de un solo uso de los que **solo se guarda el SHA-256**.
- **API** (`src/app/api/v1/`): `auth/register`, `auth/verify_email`, `auth/resend_verification`,
  `health` y `me`, todas siguiendo `rules/api-conventions.md`. Los helpers de respuesta y error
  viven en `src/server/http.ts` y los reutilizarán todos los endpoints de las fases siguientes.
- **Guardas**: `src/middleware.ts` protege la navegación del panel; `src/server/auth/guards.ts`
  (`requiereNutriologo`) revalida sesión, correo verificado y rol en cada handler; el layout
  `(panel)/layout.tsx` vuelve a comprobar en el servidor. Tres capas, porque un matcher mal
  escrito no debe traducirse en expedientes visibles.
- **UI**: `/registro`, `/login` y `/verificar` reales; el "login simulado" y el flag `loggedIn`
  del store de demo quedaron eliminados.
- **CI** (`.github/workflows/ci.yml`): levanta un Postgres efímero, aplica las migraciones,
  falla si `schema.prisma` cambió sin su migración, y corre type-check, tests y build.

Verificado: `tsc --noEmit` limpio, 39 tests en verde (16 nuevos sobre helpers de API, hashing
de contraseñas y ciclo de vida de los tokens), y `next build` exitoso.

**Desviaciones respecto al plan original**, y por qué:

1. **bcryptjs en lugar de argon2.** argon2 es una extensión nativa: complica el build en Windows
   y en el runtime de Vercel. bcryptjs es JS puro, ampliamente auditado y suficiente con 12
   rondas. Se rechazan contraseñas de más de 72 bytes en vez de dejar que bcrypt las trunque
   en silencio.
2. **Rate limiting en memoria** (`src/server/rate-limit.ts`) en registro, verificación y reenvío.
   Frena bucles simples, pero cada instancia serverless lleva su propia cuenta; se reemplaza por
   Upstash en la fase 8, como marca la sección 6.
3. **El registro responde 409 `EMAIL_TAKEN`** cuando el correo ya existe. Revela que la cuenta
   existe, a cambio de un mensaje claro; el resto de los flujos (login, reenvío de verificación)
   sí responden de forma neutra, y el login compara contra un hash señuelo para que la latencia
   no delate qué correos están dados de alta.
4. **Se puede iniciar sesión sin haber verificado el correo**, pero el middleware manda a
   `/verificar`. Da un mensaje mucho más útil que un "credenciales inválidas" genérico y evita
   depender de detalles inestables de la beta de Auth.js para propagar el motivo del rechazo.

**Verificado contra la base real** (Neon, proyecto `nutria`, branch `production`, región
`us-east-2`): la migración `0_init` aplicó las 28 tablas y 15 enums; `/api/v1/health` responde
`ok` con ~80 ms de latencia; y el flujo de alta corre de punta a punta — registro, correo
verificado, contraseña guardada como hash bcrypt, perfil y suscripción Free creados
automáticamente, token de un solo uso rechazado al reintentarse, correo duplicado detectado
aun cambiando mayúsculas, `/api/v1/me` respondiendo 401 sin sesión, `/pacientes` redirigiendo
a `/login`, y borrado en cascada sin registros huérfanos. La cuenta de prueba se eliminó: la
base quedó vacía y lista para las cuentas reales.

---

## 14. Riesgos y decisiones abiertas

- **SMAE**: no se copia la obra; si el negocio exige los valores exactos del SMAE oficial, evaluar licencia editorial en V2.1. Mientras, la base propia (USDA + INCMNSZ + captura núcleo MX) es defendible y suficiente para práctica clínica.
- **NestJS**: `CLAUDE.md` prevé `apps/api`; esta V2 lo pospone deliberadamente a favor de velocidad de despliegue en Vercel. El contrato `/api/v1` conforme a `api-conventions.md` hace la extracción futura de bajo costo. Actualizar `CLAUDE.md` al aprobar este plan.
- **App móvil**: la V2 web define el contrato que la app del paciente consumirá; los endpoints de logs/mensajes/plan ya lo contemplan. El paciente sin app puede recibir plan por PDF/email mientras tanto.
- **Videollamada**: fuera de V2; el campo `video_url` acepta un link externo (Zoom/Meet) que el nutriólogo pega.
- **CFDI 4.0**: pospuesto a V2.1 con Facturapi (documentado en sección 9).
- **Costo fijo mensual estimado V2 en producción**: Vercel Pro $20 + Neon Launch $19 + Resend $0 + Upstash $0 + Sentry $0 (capas gratuitas) + IA variable ≈ **$40–60 USD/mes** hasta ~50 nutriólogos activos.
