# Plan — App web del paciente (`apps/web/pacientes`)

> Convertir el prototipo móvil `MVP/app-movil/nutria-paciente-mvp.jsx` en una app web real,
> mobile-first e instalable (PWA), que consume la misma base de datos y la misma lógica de
> negocio que el panel del nutriólogo.
>
> Reorganización asociada: lo que hoy vive en `apps/web` pasa a `apps/web/nutriologos`, y la
> nueva app del paciente nace en `apps/web/pacientes`.
>
> Documento hermano: `MVP/app-web/PLAN-V2-PRODUCCION.md` (panel del nutriólogo, fases 1–8, ya completadas).

---

## 1. Diagnóstico

### Qué es hoy el MVP móvil

`nutria-paciente-mvp.jsx` — 806 líneas, un solo archivo, prototipo funcional en React:

| Pantalla | Contenido | Estado real |
|---|---|---|
| Onboarding | Marca + 3 promesas + botón "Entrar" | Booleano en memoria, sin login |
| **Hoy** | Anillo de calorías, barras de macros, vasos de agua, adherencia del día, plan del día con check, acceso al coach | Datos constantes en el archivo |
| **Plan** | Selector de día de la semana, comidas con porción y kcal, pestaña de recetas con detalle y sustitución IA | Datos constantes |
| **Registrar** (hoja) | Comida por texto con estimación IA, foto (`alert`), peso, ejercicio (`alert`) | Solo comida y peso funcionan, en memoria |
| **Progreso** | Perdido/actual/falta, gráfica de peso SVG de 6 semanas, 6 logros | Datos constantes |
| **Mensajes** | Chat con la nutrióloga | Respuesta simulada con `setTimeout` |
| **Perfil** | Datos, nutrióloga, objetivo, recordatorios, privacidad, cerrar sesión | Cada fila es un `alert` |

Tres problemas que el plan resuelve de raíz:

1. **`callClaude` llama a `https://api.anthropic.com/v1/messages` desde el navegador.** En producción eso expone la API key. Toda IA pasa por el servidor, reutilizando `src/server/ai` (streaming, seudonimización, validación Zod, cuotas en `ai_usage`) — ver `ai-guidelines.md`.
2. **No hay identidad de paciente.** El esquema ya tiene `patients.user_id` y `UserRole.END_USER`, pero no existe flujo de invitación ni guarda de autorización para pacientes.
3. **El marco de teléfono es decorativo.** La app web real usa layout mobile-first a ancho completo, con manifest PWA e instalación desde el navegador.

### Qué ya existe en el backend y se reutiliza tal cual

| Pieza | Se reutiliza para |
|---|---|
| `meal_plans` + `meal_plan_meals` + `meal_plan_items` (con `activado_at`, `compartido_at`) | Pantallas Hoy y Plan |
| `meal_logs`, `weight_logs`, `exercise_logs` | Registro y Progreso |
| `messages` con `MessageSender.PATIENT` | Mensajes (el nutriólogo ya lee y escribe en esa tabla) |
| `recipes` con `estado = ENVIADA`, `activity_plans` con `compartido_at` | Plan → Recetas, plan de actividad |
| `packages/shared`: `adherencia.ts`, `nutricion/`, `alergias.ts`, `ia/seudonimizar.ts`, `ia/limites.ts` | Cálculos y guardas de IA, sin duplicar |
| `src/server/ai/*` (cliente, prompts, validación, uso) | Coach, estimación de comida, sustitución de ingrediente |
| `src/server/crypto.ts`, `audit.ts`, `rate-limit.ts`, `http.ts`, `logger.ts` | Cifrado clínico, bitácora, límites, envolturas de respuesta |
| `packages/ui-tokens` | Misma identidad visual que el panel |

### Huecos reales del modelo de datos

| Hueco | Impacto | Solución (§5) |
|---|---|---|
| `meal_logs` no guarda calorías ni macros | El anillo de "Hoy" no puede sumar lo registrado fuera del plan | Columnas nuevas, nullables |
| No existe registro de agua | La tarjeta de agua no tiene dónde persistir | Tabla `water_logs` |
| No hay token de invitación de paciente | El paciente no puede crear cuenta | Tabla `patient_invites` |
| `meal_plans` describe **un** día, no una semana | El selector L–M–M–J–V–S–D del prototipo no tiene datos detrás | El plan se muestra como plan diario vigente; la vista semanal queda fuera de alcance V1 (§12) |
| Racha y logros | No hay tabla | Se **calculan** en `packages/shared`, no se almacenan (§9, Fase 8) |

---

## 2. Decisión de arquitectura

**Dos aplicaciones Next.js independientes bajo `apps/web/`, con un paquete de servidor compartido.**

```
apps/
  web/
    nutriologos/      # la app actual, movida tal cual (panel, /api/v1, Stripe, crons)
    pacientes/        # nueva app: PWA mobile-first del paciente
packages/
  servidor/           # NUEVO: prisma (schema + migraciones + seed) y capa de servidor compartida
  shared/             # lógica de negocio pura (sin cambios de rol)
  ui-tokens/          # design tokens (sin cambios)
```

Por qué así y no de otra forma:

- **Dos apps, no una con grupos de ruta.** Son dos productos con audiencias, dominios, sesiones y superficies de ataque distintas. Un bug de autorización en el panel no debe poder alcanzar rutas del paciente y viceversa. Además permite desplegarlas y escalarlas por separado.
- **Cada app expone solo sus endpoints.** `pacientes` no monta `/api/v1/patients/[id]/*` (rutas del nutriólogo) y `nutriologos` no monta `/api/v1/me/*` del paciente. Menos superficie que auditar.
- **Nada de duplicar la capa de servidor.** Repositorios, Prisma, auth, IA, cifrado y bitácora viven una sola vez en `packages/servidor`. Duplicar `src/server` garantizaría que en tres meses las dos copias diverjan — exactamente lo que `CLAUDE.md` prohíbe para la lógica compartida.
- **Una sola base de datos y un solo esquema Prisma.** El paciente escribe en `meal_logs` y el nutriólogo lo lee en su pestaña de seguimiento sin sincronización de por medio.

### Sesiones

Cada app corre su propio NextAuth con el mismo `AUTH_SECRET` y el mismo adaptador Prisma, pero con
cookies y dominios distintos (`app.nutria.mx` y `mi.nutria.mx`). El callback `authorized` de cada
app restringe por rol:

- `nutriologos`: `NUTRITIONIST` o `ADMIN` (ya implementado en `requiereNutriologo`).
- `pacientes`: `END_USER` con `patients.user_id` vinculado y `patients.deleted_at IS NULL`.

Un nutriólogo que intente entrar a la app del paciente recibe 403, y al revés. No se comparte cookie entre subdominios.

---

## 3. Fase 0 — Reorganización del monorepo (mecánica, sin cambio funcional)

Se hace en un commit propio, verificable: al terminar, el panel del nutriólogo debe comportarse
exactamente igual que antes.

### 3.1 Mover la app

```bash
git mv apps/web apps/web-tmp
mkdir -p apps/web
git mv apps/web-tmp apps/web/nutriologos
```

(El rodeo por `web-tmp` evita mover un directorio dentro de sí mismo.) Usar `git mv` — no copiar y
borrar — para que el historial de cada archivo sobreviva.

### 3.2 Workspaces

`package.json` raíz: `"workspaces": ["apps/web/*", "packages/*"]`.
El glob `apps/*` deja de servir: `apps/web` ya no tiene `package.json` y npm falla.

Scripts raíz:

```json
"dev:nutriologos":  "npm run dev  --workspace apps/web/nutriologos",
"dev:pacientes":    "npm run dev  --workspace apps/web/pacientes",
"build:nutriologos":"npm run build --workspace apps/web/nutriologos",
"build:pacientes":  "npm run build --workspace apps/web/pacientes",
"db:migrate":       "npm run db:migrate --workspace packages/servidor",
"db:seed":          "npm run db:seed --workspace packages/servidor"
```

`dev:web` se conserva como alias de `dev:nutriologos` un par de semanas para no romper la memoria
muscular ni los scripts locales.

### 3.3 Puertos y URLs de desarrollo

| App | Puerto | `AUTH_URL` local |
|---|---|---|
| nutriologos | 3000 | `http://localhost:3000` |
| pacientes | 3001 | `http://localhost:3001` |

`"dev": "next dev --port 3001"` en `apps/web/pacientes/package.json`.

### 3.4 Renombrar el paquete

`apps/web/nutriologos/package.json`: `"name": "web"` → `"name": "nutriologos"`.
Buscar referencias a `--workspace apps/web` y a la ruta `apps/web/` en: scripts de `package.json`,
`playwright.config.ts`, `jest.config.mjs`, workflows de CI, `deploy-config.md`, `CLAUDE.md`,
`vercel.json` y los `.md` de `MVP/app-web/`.

### 3.5 Verificación de la fase

```bash
npm install
npm run type-check --workspaces --if-present
npm run test --workspaces --if-present
npm run build:nutriologos
npm run dev:nutriologos   # login, listar pacientes, abrir un plan
```

Criterio de aceptación: **cero cambios de contenido en archivos `.ts`/`.tsx`** salvo rutas en
configuración. `git log --follow` sigue mostrando el historial de cualquier archivo movido.

---

## 4. Fase 1 — `packages/servidor` (capa compartida)

### 4.1 Qué se mueve

```
packages/servidor/
  package.json           # name: @nutria/servidor
  prisma/
    schema.prisma        # desde apps/web/nutriologos/prisma/
    migrations/
    seed/
  scripts/               # db:encrypt, launch:check, ai:check, pilot:status, load/
  src/
    server/              # todo apps/web/nutriologos/src/server, tal cual
      db.ts  http.ts  logger.ts  crypto.ts  audit.ts  email.ts  cron.ts
      rate-limit.ts  rate-limit-key.ts  load-safety.ts  openapi.ts  onboarding.ts
      auth/  ai/  patients/  plans/  foods/  messages/  appointments/
      tracking/  consultations/  profile/  billing/  pdf/  testing/
    config/              # privacy.ts, brandLogo.ts
    domain/              # planLimits.ts
    components/pdf/      # MealPlanDocument y compañía (las usa server/pdf)
    types/               # next-auth.d.ts
```

Es decir: **todo `src/server`** más `prisma/` y `scripts/`. Los tests colocados (`*.test.ts`) se
mueven con sus módulos.

El paquete replica el layout que esas carpetas tenían dentro de la app (`src/server/…`, no
`src/…`) porque `src/server` no era autocontenido: importa `@/config/privacy`,
`@/config/brandLogo`, `@/domain/planLimits` y `@/components/pdf/MealPlanDocument`. Al conservar
el mismo layout, esos imports siguen resolviendo sin tocarse (§4.2), y `agendaFormato.ts` —el otro
archivo de `src/domain`, que depende de `@/services`— se queda en la app, donde pertenece.

`billing/` y `pdf/` se mueven aunque hoy solo los use el panel: quedan en el paquete por cohesión
(dependen de `db.ts` y `crypto.ts`), y solo `nutriologos` monta las rutas que los usan.

### 4.2 Cómo se resuelven los imports sin tocar 200 archivos

Los módulos movidos siguen importando `@/server/db`, `@/server/http`, etc. En lugar de reescribirlos,
cada app resuelve el alias primero en su propio `src` y, si no encuentra, en el paquete:

`apps/web/{nutriologos,pacientes}/tsconfig.json`:

```json
"paths": {
  "@/*": ["./src/*", "../../../packages/servidor/src/*"]
}
```

Una sola regla en vez de una por carpeta, porque el paquete replica el layout de la app (§4.1).
El orden importa: lo que exista en el `src` de la app gana, así que una app puede sobreescribir un
módulo compartido poniendo uno propio en la misma ruta.

`jest.config.mjs` de ambas apps: el mismo arreglo ordenado en `moduleNameMapper`.

No hace falta `transpilePackages: ['@nutria/servidor']`: como el alias apunta a una **ruta
relativa** y no a `node_modules`, Next compila esos archivos como código fuente de la app. El
paquete sí se declara como dependencia (`"@nutria/servidor": "*"`) para que npm lo enlace y
`--workspaces` lo incluya en type-check y tests.

La ampliación de módulo de Auth.js (`types/next-auth.d.ts`) viaja con la configuración de sesión,
pero un `.d.ts` solo surte efecto si forma parte del programa: cada app lo agrega a su `include`.

Ventaja: la Fase 1 no modifica el contenido de ningún módulo de servidor, así que un `git diff`
de la fase es puro movimiento y configuración. Costo: un alias no obvio, documentado con un comentario
en cada `tsconfig.json`. Si más adelante estorba, se migra a imports explícitos `@nutria/servidor/...`
con un codemod, sin prisa.

### 4.3 Dependencias

Pasan a `packages/servidor`: `@prisma/client`, `prisma`, `bcryptjs`, `@anthropic-ai/sdk`, `zod`,
`zod-openapi`, `@auth/prisma-adapter`, `next-auth`, `resend`, `stripe`, `@upstash/*`,
`@vercel/blob`, `@react-pdf/renderer`, `tsx`. También `next`, `react` y `@sentry/nextjs`, que el
paquete usa de verdad (`next/server`, JSX de `@react-pdf`, `logger.ts`).

Se quedan en cada app: `next`, `react`, `react-dom`, `@tanstack/react-query`, `lucide-react`,
`tailwindcss`, `@sentry/nextjs`. Salen de la app solo las que dejó de importar del todo:
`@anthropic-ai/sdk`, `@auth/prisma-adapter`, `@react-pdf/renderer`, `@upstash/*`, `@vercel/blob`,
`resend`, `zod-openapi`. `@prisma/client`, `bcryptjs`, `next-auth`, `stripe` y `zod` se declaran en
los dos, porque los dos los importan; npm los resuelve a una sola copia izada.

Los archivos de `scripts/` y de `prisma/` se mueven al paquete, pero **los scripts de npm que los
invocan se quedan en `apps/web/nutriologos/package.json`**, apuntando al paquete con `--schema` y
rutas relativas (`prisma migrate dev --schema ../../../packages/servidor/prisma/schema.prisma`).
Razón: el CLI de Prisma solo lee un `.env` del directorio desde el que corre, y el `.env` local
—con `DATABASE_URL`— vive en la app porque Next también lo necesita en tiempo de ejecución.
Anclarlos ahí evita duplicar la cadena de conexión en dos archivos, y coincide con §11: solo
`nutriologos` corre migraciones. El `package.json` raíz expone `db:migrate`, `db:deploy`,
`db:status` y `db:seed` como atajos a ese workspace.

### 4.4 Verificación

Igual que la Fase 0, más: `npx prisma migrate status` sin migraciones pendientes ni drift, y la
suite completa de E2E del panel en verde (`npm run test:e2e --workspace apps/web/nutriologos`).

---

## 5. Fase 2 — Modelo de datos que falta ✅

Una migración por tema, todas expand-only (columnas nullables, tablas nuevas): reversibles y sin
downtime, conforme a `deploy-config.md`.

### 5.1 `meal_logs` — macros del registro libre

```prisma
model MealLog {
  // ...existente
  calorias   Int?           // kcal estimadas o declaradas
  proteinaG  Float?  @map("proteina_g")
  carbosG    Float?  @map("carbos_g")
  grasaG     Float?  @map("grasa_g")
  origen     ContentOrigin @default(MANUAL)  // MANUAL | IA (estimación del coach)
  hora       DateTime?      // momento del registro; `fecha` sigue siendo el día natural
}
```

Nullables porque los registros existentes (creados desde el panel) no los tienen. El anillo de "Hoy"
suma `meal_plan_items` de las comidas marcadas + `meal_logs.calorias` de los registros libres.

### 5.2 `water_logs` — nueva tabla

```prisma
model WaterLog {
  id        String   @id @default(uuid()) @db.Uuid
  patientId String   @map("patient_id") @db.Uuid
  fecha     DateTime @db.Date
  vasos     Int      @default(0)
  updatedAt DateTime @updatedAt @map("updated_at")

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@unique([patientId, fecha])
  @@map("water_logs")
}
```

Un renglón por paciente y día, actualizado con `upsert`. La meta diaria de vasos vive en
`food_preferences` (campo nuevo `meta_agua_vasos`, default 8) porque la fija el nutriólogo.

### 5.3 `patient_invites` — alta de cuenta del paciente

```prisma
model PatientInvite {
  id         String    @id @default(uuid()) @db.Uuid
  patientId  String    @map("patient_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash")   // hash, nunca el token en claro
  email      String
  expiresAt  DateTime  @map("expires_at")
  usedAt     DateTime? @map("used_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("patient_invites")
}
```

Mismo patrón que `EmailVerificationToken` (ver `src/server/auth/tokens.ts`): se guarda el hash,
caduca a 7 días, un solo uso, y el envío se reutiliza de `src/server/email.ts` (Resend).

### 5.4 Metas del paciente

`meta_calorias`, `meta_proteina_g`, `meta_carbos_g`, `meta_grasa_g` **no** se agregan: ya salen del
`meal_plan` activo (`calorias_diarias`, `proteina_g`, `carbos_g`, `grasa_g`). Si no hay plan activo
y compartido, la app del paciente muestra un estado vacío ("Tu nutrióloga aún no comparte tu plan"),
no ceros.

### 5.5 Verificación

Migraciones aplicadas en una BD desechable (ver memoria `correr-e2e-local-con-postgres-docker`),
`prisma migrate status` limpio, y tests del repositorio de seguimiento en verde.

---

## 6. Fase 3 — Identidad del paciente ✅

### 6.1 Flujo

1. El nutriólogo abre la ficha del paciente → **"Invitar a la app"**. Requiere `patients.email`
   y consentimiento de datos sensibles ya registrado (`sensitive_data_consent_at`).
2. `POST /api/v1/patients/{id}/invite` (app nutriólogos) crea el `PatientInvite` y envía correo con
   `https://mi.nutria.mx/activar?token=…`.
3. El paciente abre el enlace, ve el aviso de privacidad (`src/config/privacy.ts`) y define contraseña.
4. `POST /api/v1/auth/activate` (app pacientes; la ruta se monta en la Fase 6, la lógica ya existe
   como `activarCuentaPaciente` — ver §15): valida token → crea `User` con `role = END_USER`,
   `email_verified = now()`, `privacy_notice_accepted_at` → enlaza `patients.user_id` → marca
   `used_at` → registra en `audit_logs`. Todo en una transacción.
5. Sesión iniciada, entra a "Hoy".

Reinvitación: si ya hay `user_id`, el endpoint responde 409 y ofrece "recuperar contraseña" en su lugar.

### 6.2 Guarda de autorización

Nueva `requierePaciente()` en `packages/servidor/src/server/auth/guards.ts`, hermana de `requiereNutriologo()`:

```ts
export type SesionPaciente = { ok: true; sesion: Session; userId: string; patientId: string };

export async function requierePaciente(): Promise<SesionPaciente | SesionInvalida>
```

Resuelve el `patientId` a partir de `session.user.id` **en el servidor**, en cada petición. Regla
innegociable: **ningún endpoint de la app del paciente acepta un `patient_id` del cliente.** Si una
ruta lo necesitara, se compara contra el resuelto y se responde 403 ante discrepancia.

Verifica además: `user.role === 'END_USER'`, `user.deleted_at IS NULL`, `patient.deleted_at IS NULL`
y `patient.estado === 'ACTIVO'` (un paciente archivado pierde el acceso, no los datos).

### 6.3 Tests obligatorios de esta fase

- Unitarios de `requierePaciente`: sin sesión, rol equivocado, paciente archivado, paciente borrado, feliz.
- Unitarios de token: caducado, ya usado, hash que no coincide, paciente ya vinculado.
- E2E `aislamiento-pacientes.spec.ts`: el paciente A no ve absolutamente nada del paciente B —
  plan, mensajes, registros, recetas — probando cada endpoint de `/api/v1/me/*`.

---

## 7. Fase 4 — API v1 del paciente ✅

Todas bajo `/api/v1/me/*`, montadas **solo** en `apps/web/pacientes`, siguiendo `api-conventions.md`
(snake_case plural, `{ data, meta }`, errores `{ error: { code, message, details } }`, fechas ISO 8601 UTC).

| Método y ruta | Qué hace | Notas |
|---|---|---|
| `GET /me` | Perfil: nombre, objetivo, nutriólogo, metas del plan activo | Reemplaza `PACIENTE_INICIAL` |
| `GET /me/today` | Plan del día + comidas marcadas + agua + adherencia + racha | Una sola llamada para la pantalla Hoy |
| `GET /me/meal_plan` | Plan vigente con comidas e items | Solo `estado = ACTIVO` **y** `compartido_at != null` |
| `GET /me/recipes` | Recetas del paciente | Solo `estado = ENVIADA` |
| `GET /me/activity_plan` | Plan de actividad | Solo con `compartido_at != null` |
| `POST /me/meal_logs` | Marca una comida del plan o registra una libre | `meal_plan_meal_id` opcional |
| `DELETE /me/meal_logs/{id}` | Desmarca | Valida pertenencia por `patientId` resuelto |
| `GET/POST /me/weight_logs` | Peso | `upsert` por `(patient_id, fecha)` |
| `GET/POST /me/exercise_logs` | Ejercicio | tipo + duración |
| `PUT /me/water_logs` | Vasos del día | `upsert` idempotente |
| `GET /me/progress` | Serie de peso, kg perdidos, faltantes, logros | Cálculo en `packages/shared` |
| `GET/POST /me/messages` | Chat con el nutriólogo | `emisor = PATIENT`; polling, igual que el panel |
| `POST /me/messages/read` | Marca leídos | |
| `GET /me/appointments` | Próximas citas | Solo lectura en V1 |
| `POST /me/ai/coach` | Coach conversacional | §8 |
| `POST /me/ai/meal_estimate` | Estima macros de un texto | §8 |
| `POST /me/ai/substitution` | Sustituye un ingrediente | §8 |
| `POST /me/photos` | Sube foto de comida a Vercel Blob | Devuelve URL para `meal_logs.foto_url` |

Límites de tasa (`rate-limit.ts`) por `user_id`: escritura 60/min, IA según §8, subida de fotos 20/hora.

---

## 8. Fase 5 — IA del paciente ✅

Tres casos de uso nuevos en `packages/servidor/src/server/ai/config.ts`:

| Tipo | Modelo | Estructurado | Presupuesto |
|---|---|---|---|
| `COACH_PACIENTE` | Haiku 4.5 | No (texto breve) | 400 tokens |
| `ESTIMACION_COMIDA` | Haiku 4.5 | Sí (Zod: `alimento`, `calorias`, `proteina_g`, `carbos_g`, `grasa_g`) | 300 tokens |
| `SUSTITUCION_INGREDIENTE` | Haiku 4.5 | Sí (Zod: `sustituto`, `razon`) | 300 tokens |

Guardas, todas heredadas de `ai-guidelines.md` y del principio 7 de `CLAUDE.md`:

1. **La IA nunca modifica el plan.** El coach responde dudas y remite a la nutrióloga; no cambia
   comidas, metas ni horarios. Se instruye en el prompt **y** se garantiza por diseño: ningún
   endpoint de IA del paciente escribe en `meal_plans`.
2. **La estimación de comida escribe solo en `meal_logs`** del propio paciente, con `origen = IA`,
   y la UI la etiqueta como estimación. Nunca en el expediente clínico.
3. **Seudonimización antes de enviar** (`packages/shared/src/ia/seudonimizar.ts`): nada de nombre
   completo, correo, teléfono ni notas clínicas en el prompt. El coach recibe objetivo, meta calórica
   y nombre de pila.
4. **Sin diagnósticos.** El prompt del sistema prohíbe explícitamente indicaciones médicas, ajustes
   de medicación y juicios sobre síntomas; ante ese tipo de pregunta, deriva a la nutrióloga y ofrece
   abrir el chat con ella.
5. **Cuota.** `ai_usage` se contabiliza contra el `user_id` del **nutriólogo dueño** del paciente, no
   del paciente: es quien paga la suscripción. Se agrega un tope propio por paciente (p. ej. 30
   interacciones/mes) para que un paciente no consuma la cuota de la clínica. Ambos límites viven en
   `packages/shared/src/ia/limites.ts`, con su test.
6. **Aviso visible** en coach y estimación: "Orientación general. No sustituye a tu nutrióloga."
   (ya está en el prototipo; se conserva textual).

---

## 9. Fases 6–11 — Construcción de la app

Cada fase termina con: tests en verde, `type-check` limpio, revisión con el agente `code-reviewer`,
y un commit propio.

### Fase 6 — Cascarón, PWA e identidad visual ✅

- `apps/web/pacientes` con App Router, Tailwind y `@nutria/ui-tokens` (mismas fuentes Fraunces/Inter/
  IBM Plex Mono, misma paleta esmeralda del prototipo — pero con `next/font`, no un `<link>` inyectado
  en `useEffect`).
- Layout mobile-first: contenedor `max-w-[480px]` centrado, sin marco de teléfono.
- `BottomNav` (Hoy · Plan · **+** · Progreso · Mensajes) con `next/link` y estado activo por ruta.
- Rutas: `/` (Hoy), `/plan`, `/progreso`, `/mensajes`, `/perfil`, `/entrar`, `/activar`.
- `manifest.webmanifest`, iconos, `theme-color`, `apple-mobile-web-app-capable`, service worker
  mínimo (offline shell). Sin push notifications en V1 (§12).
- `proxy.ts` protegiendo todo salvo `/entrar`, `/activar`, `/privacidad`.
- Providers: React Query + Sentry, copiados de la app de nutriólogos.

**Aceptación:** el paciente demo entra, ve el cascarón navegable con estados vacíos, y la app se
instala desde Chrome Android e iOS Safari.

### Fase 7 — Hoy y registro ✅

- Anillo de calorías, `MacroBar`, tarjeta de agua, tarjeta de adherencia, lista del plan con check
  optimista (React Query `onMutate` + rollback).
- Hoja de registro: comida por texto (IA), foto (cámara vía `<input capture>` → Blob), peso, ejercicio.
- Los cuatro botones del prototipo funcionan; ninguno queda como `alert`.
- Adherencia y racha desde `packages/shared/src/adherencia.ts`, sin duplicar la fórmula del panel.

**Aceptación:** marcar una comida se refleja de inmediato en la pestaña de seguimiento del nutriólogo.

### Fase 8 — Plan y recetas

- Plan diario vigente con porciones y kcal por comida; estado vacío si no hay plan compartido.
- Recetas enviadas, detalle con ingredientes y pasos, sustitución de ingrediente con IA.
- Plan de actividad compartido, si existe.

### Fase 9 — Progreso y logros

- Tarjetas perdido/actual/falta y gráfica de peso (reutilizar `WeightChart.tsx` del panel — se mueve
  a `packages/ui-tokens` o a un `packages/ui` nuevo si crece; mientras tanto se copia con nota de deuda).
- Logros **calculados** en `packages/shared/src/logros.ts` a partir de los registros reales:
  racha de N días, meta de agua N días, semana completa de registros, primeros N kg, peso meta, N días
  activo. Función pura con tests de tabla — no hay estado que se desincronice ni tabla que migrar.

### Fase 10 — Mensajes

- Hilo con el nutriólogo, polling cada 15 s (mismo patrón que `useMensajes.ts` del panel), marcado
  de leídos, indicador de no leídos en la nav inferior.
- Sin simulaciones: el `setTimeout` que fingía la respuesta de la nutrióloga desaparece.

### Fase 11 — Perfil, privacidad y cuenta

- Datos del paciente (lectura), nutriólogo asignado, objetivo, recordatorios, aviso de privacidad
  versionado, cambio de contraseña, cerrar sesión.
- **Derechos ARCO** (`LANZAMIENTO-FASE-8.md`): descargar mis datos y solicitar baja de la app.
  La baja desvincula `user_id` y borra la cuenta; el expediente clínico permanece con el nutriólogo,
  que es su responsable, y se le notifica.
- Todo acceso a datos sensibles queda en `audit_logs`.

---

## 10. Pruebas

Cobertura mínima 80 % (`testing.md`). Por tipo:

**Unitarios** — `packages/shared`: logros, racha, adherencia con registros libres, límites de IA por
paciente. `packages/servidor`: `requierePaciente`, tokens de invitación, repositorio de `water_logs`,
esquemas Zod de la IA del paciente.

**Integración** — cada handler de `/api/v1/me/*`: sin sesión (401), rol equivocado (403), paciente de
otro nutriólogo (403/404), validación de payload (422), caso feliz.

**E2E (Playwright, `apps/web/pacientes/e2e/`)** — con Postgres desechable en Docker:

1. `activacion.spec.ts` — invitación → correo → contraseña → primera sesión.
2. `hoy.spec.ts` — marcar comidas, agua, ver anillo y adherencia actualizarse.
3. `registro-ia.spec.ts` — registrar comida por texto (Anthropic mockeado), aparece en Hoy.
4. `plan-recetas.spec.ts` — plan compartido y receta enviada visibles; borrador **no** visible.
5. `progreso.spec.ts` — registrar peso, gráfica y logros actualizados.
6. `mensajes.spec.ts` — ida y vuelta real contra la app del nutriólogo.
7. `aislamiento-pacientes.spec.ts` — el paciente A no alcanza nada del paciente B (§6.3).
8. `arco.spec.ts` — exportación de datos y baja de cuenta.

Los E2E existentes del panel siguen corriendo sin cambios más allá de la ruta del proyecto.

---

## 11. Despliegue

Dos proyectos de Vercel apuntando al mismo repositorio:

| | nutriologos | pacientes |
|---|---|---|
| Root Directory | `apps/web/nutriologos` | `apps/web/pacientes` |
| Dominio | `app.nutria.mx` | `mi.nutria.mx` |
| Build | `npm run build` (incluye `prisma generate`) | igual |
| Crons | `vercel.json` con recordatorios de cita | **ninguno** |
| Webhooks Stripe | `/api/webhooks/stripe` | ninguno |

Variables de entorno de `pacientes`: `DATABASE_URL` (misma BD), `AUTH_SECRET` (mismo valor),
`AUTH_URL=https://mi.nutria.mx`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`,
`UPSTASH_*`, `SENTRY_*`, `ENCRYPTION_KEY` (misma clave: lee notas cifradas del mismo esquema).
**Sin** claves de Stripe: el paciente no paga nada en V1.

Migraciones: las corre **solo** el proyecto `nutriologos` (`prisma migrate deploy` en su build), para
que dos despliegues simultáneos no compitan por el bloqueo de migración. `pacientes` solo genera cliente.

Orden de la primera salida a producción: migraciones → desplegar `nutriologos` → desplegar `pacientes`
→ invitar a 3 pacientes piloto de un solo nutriólogo → revisar `audit_logs` y Sentry 48 h antes de abrir.

---

## 12. Fuera de alcance de la V1

Se dejan fuera a propósito, y se anotan aquí para que no se cuelen a mitad de camino:

- **Vista semanal del plan.** El modelo guarda un plan diario; una semana real exige rediseñar
  `meal_plans` con días. Se evalúa cuando lo pida un nutriólogo real.
- **Reconocimiento de comida por foto con IA.** La foto se sube y se adjunta al registro; estimar
  macros desde la imagen es un caso de uso aparte, con su propio costo y validación.
- **Notificaciones push.** Los recordatorios siguen por correo (cron ya existente). Web Push en iOS
  exige la PWA instalada y agrega complejidad de permisos.
- **App nativa (React Native/Expo).** `CLAUDE.md` la contempla; esta V1 es web instalable. La API
  `/api/v1/me/*` queda diseñada para que una app nativa la consuma después sin cambios.
- **Cobros al paciente.** `invoices` existe, pero cobrar desde la app del paciente es producto nuevo.
- **Chat en tiempo real.** Polling, igual que el panel. WebSockets cuando el volumen lo justifique.

---

## 13. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| El alias `@/server/*` apuntando fuera del app confunde a alguien o a una herramienta | Comentario en cada `tsconfig.json`; `type-check` y jest configurados igual; salida clara si se decide migrar a imports `@nutria/servidor/...` |
| La Fase 0/1 rompe el panel en producción | Ambas fases son movimientos sin cambio funcional, con la suite E2E completa como red; se despliegan solas, antes de escribir una línea de la app del paciente |
| Un paciente ve datos de otro | `requierePaciente` resuelve el `patientId` en el servidor y ningún endpoint lo acepta del cliente; E2E dedicado; revisión con el agente `security-auditor` antes de la fase de despliegue |
| El paciente ve un plan que la nutrióloga aún no aprueba | Todo lo que la app del paciente lee se filtra por `compartido_at`/`estado`, nunca por "existe" |
| Un paciente agota la cuota de IA de la clínica | Tope propio por paciente además del tope por plan |
| Dos despliegues compiten por las migraciones | Solo `nutriologos` ejecuta `migrate deploy` |

---

## 14. Resumen de fases

| # | Fase | Entregable | Depende de |
|---|---|---|---|
| 0 | **Reorganización** ✅ | `apps/web/nutriologos` funcionando idéntico | — |
| 1 | **`packages/servidor`** ✅ ⚠️ | Capa de servidor compartida, panel intacto. **Gate de E2E (§4.4) sin cumplir — ver §15** | 0 |
| 2 | **Modelo de datos** ✅ | Migraciones de `meal_logs`, `water_logs`, `patient_invites` | 1 |
| 3 | **Identidad del paciente** ✅ | Invitación, activación, `requierePaciente` | 2 |
| 4 | **API `/api/v1/me/*`** ✅ | Endpoints con tests de integración | 3 |
| 5 | **IA del paciente** ✅ | Coach, estimación, sustitución, con cuotas y guardas | 4 |
| 6 | **Cascarón y PWA** ✅ | App navegable e instalable | 3 |
| 7 | Hoy y registro ✅ | Pantalla principal completa | 4, 5, 6 |
| 8 | Plan y recetas | Plan y recetas compartidas | 4, 6 |
| 9 | Progreso y logros | Gráfica y logros calculados | 4, 6 |
| 10 | Mensajes | Chat real bidireccional | 4, 6 |
| 11 | Perfil y ARCO | Cuenta, privacidad, exportación y baja | 4, 6 |
| 12 | E2E y despliegue | 8 specs en verde, dos proyectos en Vercel | 7–11 |

Las fases 0 a 5 son secuenciales. De la 7 a la 11 son independientes entre sí una vez lista la 6.

> **Corrección de la fase 4 (§15).** La 4 no podía ser puramente secuencial: montar `/api/v1/me/*`
> exige que `apps/web/pacientes` exista, y crearla figuraba en la 6. La fase 4 creó el cascarón
> **solo de API** (sin UI, PWA ni Tailwind); la 6 conserva íntegro su entregable visual.

---

## 15. Bitácora

### Fase 7 — Hoy y registro ✅ (2026-07-29)

La portada dejó de ser un estado vacío: ahora consume `GET /api/v1/me/today` y muestra el día real
del paciente con anillo de calorías, barras de macros, agua, adherencia, racha, comidas del plan y
registros libres. Sin plan compartido no inventa metas: conserva el registro del día y explica qué
falta para poder calcular el resto.

**Los nutrientes salen de los snapshots del plan, no de una regla aproximada en la UI.** Una comida
marcada suma sus items; una comida libre suma los macros que confirmó el paciente. Los marcadores
antiguos que no guardan macros usan el snapshot como respaldo y los duplicados heredados cuentan
una sola vez. Las kcal de un plan pueden ser fraccionarias por las medias porciones, pero
`meal_logs.calorias` acepta enteros: `nutrientesParaRegistroPlan` aplica el único redondeo justo
antes del POST y lo comparte con el estado optimista.

**Adherencia y racha siguen teniendo una sola fuente.** `/today` las calcula en el servidor con
`packages/shared/src/adherencia.ts`; el cliente no replica la fórmula ni intenta adivinar el tope
diario durante una mutación. El check cambia de inmediato y la adherencia se actualiza al recibir
el resumen canónico.

#### Checks y agua: optimismo con vuelta atrás real

Las dos interacciones usan React Query con el mismo ciclo:

1. cancelar el refetch de `/today`;
2. guardar la caché completa;
3. aplicar el check o el total de agua de inmediato;
4. restaurar exactamente la caché anterior ante error;
5. invalidar y reconciliar con el servidor al terminar.

La prueba de `useToggleComida` detiene el POST después de `onMutate`, comprueba el check inmediato,
fuerza el rechazo y verifica el rollback sobre el `QueryClient`, no solo sobre una función auxiliar.
Si existen dos marcadores antiguos para la misma comida, desmarcar elimina ambos para que el check,
el anillo y la base no se contradigan al refetch.

#### La hoja de registro ya tiene cuatro flujos

El botón central de la navegación abre una hoja global, disponible desde cualquier pestaña:

| Opción | Flujo real |
|---|---|
| Comida | descripción → estimación estructurada de IA → revisión de kcal/macros → confirmación explícita → `meal_logs` con `origen = IA` |
| Foto | `<input capture="environment">` → vista previa → subida `multipart/form-data` → URL adjunta a un registro manual |
| Peso | kg con límites del servidor → upsert del día clínico |
| Ejercicio | actividad + minutos → registro del día clínico |

La foto **no** estima nutrientes: eso sigue fuera de alcance en §12. Se guarda con una descripción
del paciente y se adjunta al diario. Una falla de red deja foto, texto o cifra en el formulario para
reintentar; la capa HTTP normaliza incluso un `fetch` rechazado a un mensaje seguro y no filtra la
URL o el error nativo.

Peso y ejercicio no usan la fecha del teléfono. Al abrir la hoja se fuerza una revalidación de
`/today` con `staleTime: 0`; ambas opciones quedan deshabilitadas hasta obtener el día en la zona
horaria del consultorio. Si la red falla, React Query puede conservar la respuesta de ayer en caché,
pero `RegistroProvider` la rechaza mientras haya `isError`. Hay una prueba específica con caché vieja
y refetch fallido.

**El coach de la portada también dejó de ser decorativo.** Usa `/api/v1/me/ai/coach`, conserva solo
el hilo de la hoja en memoria y envía como contexto los últimos seis turnos, que es el límite del
servidor. No crea otra tabla ni convierte orientación general en expediente clínico.

#### Accesibilidad y estados

`HojaModal` bloquea el scroll, vuelve inerte la rama de la app que queda detrás, atrapa `Tab` y
`Shift+Tab`, cierra con Escape y restaura el foco al botón que la abrió. Los errores se anuncian con
`role="alert"` y las confirmaciones con `role="status"`. Anillo, macros, agua y adherencia exponen
valores accesibles además del color.

#### Verificación

| Comprobación | Resultado |
|---|---|
| Suite de `apps/web/pacientes` con cobertura | **97/97**, 12 suites |
| Cobertura de líneas | **78.18 %**, supera el gate de 70 % |
| `type-check` de workspaces | Limpio en `nutriologos`, `pacientes`, `servidor`, `shared` y `ui-tokens` |
| `next build` de pacientes | Build de producción exitoso, 30 rutas |
| Revisión `code-reviewer` | 7 hallazgos corregidos; segunda revisión sin bloqueantes |

La instalación/cámara en dispositivo real y el E2E que cruza paciente → pestaña de seguimiento del
nutriólogo quedan para la fase 12, donde el plan agrupa los ocho specs de Playwright. La escritura ya
usa el mismo `meal_logs` que consume el panel, sin sincronización ni estado paralelo.

### Fase 6 — Cascarón, PWA e identidad visual ✅ (2026-07-29)

La app del paciente ya es una app: siete rutas navegables, instalable desde Chrome Android e iOS
Safari, con la misma tipografía y la misma paleta esmeralda del prototipo. Lo que se entrega es
deliberadamente un **cascarón** — las pantallas muestran estados vacíos, no datos. Los 21 endpoints
de las fases 4 y 5 siguen sin consumirse desde la UI; eso es la fase 7 en adelante.

**Los estados vacíos están escritos para el paciente, no para el equipo.** Plan dice "Tu nutrióloga
aún no comparte tu plan"; ninguna pantalla muestra un *spinner* eterno, un "próximamente" ni datos
de ejemplo. La razón de fondo: un plan de mentira en una app de salud es exactamente el tipo de cosa
que después nadie recuerda que era de mentira. En qué fase llega cada contenido queda en los
comentarios del código, que es donde le sirve a quien lo va a construir.

**La navegación es de rutas, no de `useState`.** El prototipo cambiaba de pestaña con estado local.
Aquí cada destino es una ruta con `next/link`, así que el botón de atrás del teléfono funciona, una
pantalla se puede compartir por enlace y la app instalada reabre donde el paciente la dejó. La
única lógica de `BottomNav` —qué pestaña se enciende— salió a `esRutaActiva`, función pura con
tests: con `/` en la lista, un `startsWith` ingenuo dejaría "Hoy" encendido en todas las pantallas.

**La barra inferior vive en el layout de `(app)`, no en el raíz.** `/entrar`, `/activar` y
`/privacidad` no la muestran. Ofrecer pestañas a quien no tiene sesión solo produce redirecciones.

**Las fuentes se autoalojan.** El prototipo inyectaba un `<link>` a Google dentro de un `useEffect`:
parpadeo en cada carga, una petición del navegador del paciente a un tercero y un `font-src` que
había que abrir en la CSP. Con `next/font` las tres familias (Fraunces, Inter, IBM Plex Mono) entran
al build y la CSP se queda en `font-src 'self' data:`.

**La CSP de esta app es más estrecha que la del panel.** Sin Stripe y sin llamadas directas a
Anthropic —toda la IA pasa por el servidor, §1—, ni `frame-src` de terceros ni `api.anthropic.com`
tienen por qué aparecer. Lo único que se abre de más es `camera=(self)` en `Permissions-Policy`,
que la fase 7 necesita para el registro de comida por foto.

#### El service worker está deliberadamente lisiado

Es la decisión de la fase que más fácil sería equivocar. Un caché mal puesto en una app de salud es
peor que no tener caché: una versión vieja del plan o del peso servida desde el disco es un dato
clínico equivocado presentado como actual. Las reglas son cuatro y son restrictivas a propósito:

1. Solo se cachea `/offline.html`. **Ninguna pantalla.**
2. Nunca se toca `/api/`: todo lo que responde la API va anclado a la sesión, y guardarlo dejaría
   datos de una cuenta en el disco para la siguiente persona que abra ese navegador.
3. Solo `GET` del propio origen, y solo navegaciones.
4. Red primero, siempre. El caché aparece únicamente cuando la navegación falla.

El resultado es que estar sin señal muestra una pantalla que lo dice, y nada más. La redacción de
esa pantalla se corrigió durante la fase: la primera versión daba a entender que lo registrado sin
conexión se guardaría y se enviaría después. No es cierto —no hay cola de escritura— y prometerlo
haría que alguien registrara su comida en el metro y la perdiera. Ahora dice que hace falta conexión.

`sw.js` y `offline.html` están excluidos del `matcher` del middleware. Sin esa exclusión, un service
worker redirigido a `/entrar` se instalaría con HTML en lugar de JavaScript.

#### `authConfigPacientes`: dos productos, dos configuraciones

El middleware del paciente hereda de `authConfig` lo que de verdad es común —estrategia JWT,
duración, callbacks de token y sesión— y sustituye lo que no puede serlo: a dónde se manda a quien
no tiene sesión y qué rutas son públicas. Meter las reglas del paciente dentro de `authConfig`
habría dejado un archivo decidiendo el acceso a las dos apps, que es el acoplamiento que la
arquitectura de §2 busca evitar. El proveedor de credenciales y el adaptador siguen viviendo una
sola vez en `auth/index.ts`.

Dos casos merecen su test porque son bugs esperando:

- **Un nutriólogo con sesión del panel abriendo la app del paciente.** Sin un corte explícito,
  `authorized` lo rechaza, Auth.js lo devuelve a `/entrar`, y desde ahí vuelve a rechazarlo: bucle
  infinito de redirecciones. Se le deja quedarse en `/entrar` y se le explica con `?error=sin_acceso`.
- **`/activar` con sesión ya iniciada.** Es la excepción a "quien tiene sesión no ve las pantallas
  de entrada": el enlace de invitación puede abrirse en un navegador donde ya hay otra cuenta, y
  redirigirlo dejaría la invitación sin poder consumirse nunca.

Nada de esto es control de acceso a los datos. El middleware solo evita pantallas vacías y bucles;
la autorización de verdad sigue siendo `requierePaciente` en cada handler, en cada petición.

#### `POST /api/v1/auth/activate` — la deuda de la fase 3, saldada

La lógica de activación (transacción, enlace con el expediente, quema del token) la escribió y probó
la fase 3 en `activarCuentaPaciente`; le faltaba la ruta, porque esta app no existía. Aquí se monta
con tres cosas encima:

**El consentimiento de privacidad es un `z.literal(true)`, no un `boolean` con default.**
`activarCuentaPaciente` sella `privacy_notice_accepted_at` con lo que llegue, y esa marca tiene que
corresponder a un acto real del paciente. Un default en el servidor firmaría el aviso en su nombre.

**Los cinco motivos de rechazo responden idéntico:** mismo 400, mismo `INVALID_TOKEN`, mismo texto.
Distinguir "expirado" de "ya usado" o de "el expediente está archivado" le contaría a quien pruebe
tokens al azar en qué estado está una cuenta ajena. Para el paciente legítimo la salida es la misma
en los cinco casos —pedir que le reenvíen la invitación—, así que no se pierde nada. Hay un test que
compara las cuatro respuestas entre sí y otro que verifica que el mensaje no mencione el motivo.

**El límite va por IP** (10 intentos / 15 min) y se aplica **antes** de leer el cuerpo: es de las
poquísimas rutas sin sesión, no hay cuenta contra la cual contar, y validar primero dejaría sondear
el esquema sin gastar cuota.

#### Pruebas

67 en `apps/web/pacientes` (5 suites) y 492 en `packages/servidor` (55 suites), todas en verde;
`type-check` y `next build` limpios en las dos apps web. Lo que agregó esta fase:

| Archivo | Cubre |
|---|---|
| `pacientes/src/tests/activacion.test.ts` | Caso feliz, validación, rechazo uniforme, límite por IP, 500 sin fugas |
| `pacientes/src/tests/navegacion.test.ts` | `esRutaActiva`: la raíz, las subrutas y los prefijos comunes |
| `servidor/auth/configPacientes.test.ts` | Rutas públicas, rol equivocado, el bucle de `/entrar`, `/activar` con sesión |
| `servidor/auth/schemasPaciente.test.ts` | Consentimiento obligatorio, token, herencia de la política de contraseñas |

**Sin jsdom todavía, y es una decisión, no un olvido.** La fase 4 anotó en `jest.config.mjs` que la
6 lo añadiría. No se hizo: los componentes de esta fase son enlaces, estados vacíos y clases de
Tailwind, y su única lógica está extraída como función pura y probada. Renderizarlos probaría a
React. El comentario se corrigió para que apunte a la fase 7, donde entran los formularios de
registro, que sí tienen interacción que valga un DOM.

**Dos correcciones de rumbo menores.** El test de activación se escribió esperando `422` para el
payload inválido, siguiendo §10 de este plan; manda `api-conventions.md`, que reserva el `422` para
reglas de negocio violadas y usa `400` para validación de esquema —que es lo que el `validationError`
compartido ya hacía—. Y `next-auth/providers/google` se publica solo como ESM: `packages/servidor` se
transpila a CommonJS para Jest, así que el test del middleware lo sustituye por un doble. No se
ejecuta nunca en tests, porque la configuración compartida solo lo mete en `providers` cuando hay
credenciales de Google en el entorno.

#### Lo que esta fase no hizo

- **Sin push notifications**, según §12. La PWA no las pide ni las menciona.
- **Sin `shortcuts` ni `share_target`** en el manifiesto: cada atajo apuntaría a una pantalla sin
  contenido propio, y prometer desde el icono del sistema algo que no está es peor que no ofrecerlo.
- **Sin `AppStateProvider`.** Ese store es del panel (filtros de listados, barra lateral) y aquí no
  hay nada equivalente todavía. React Query sí, con `retry: 1` y `staleTime` de 30 s, calibrado para
  un teléfono en red móvil.
- **La pantalla de perfil no trae los derechos ARCO** —descargar mis datos, solicitar la baja—: son
  de la fase 11. Lo que sí tiene es cerrar sesión, con redirección explícita para no caer en el
  bucle contra el middleware.
- **El botón `+` de la barra apunta a Hoy.** La hoja de registro llega en la fase 7; hasta entonces
  el enlace lleva a donde va a abrirse, en vez de a un `alert` como en el prototipo.

**Aceptación de §9, cumplida:** el cascarón es navegable, los estados vacíos están, la app declara
manifiesto, iconos, `theme-color` y `apple-mobile-web-app-capable`, y `viewport-fit=cover` con
`env(safe-area-inset-*)` mantiene la barra inferior fuera del área del gesto en iPhone. Falta
verificar la instalación en dispositivos reales — el build sirve el manifiesto y los tres iconos,
pero eso se comprueba en el navegador, no en CI.

### Fase 5 — IA del paciente ✅ (2026-07-29)

Los tres casos de uso de §8 están montados en `apps/web/pacientes`: `POST /me/ai/coach`,
`/me/ai/meal_estimate` y `/me/ai/substitution`. Con ellos la superficie de la API del paciente
queda cerrada en **21 endpoints**, y la fase salda además la deuda que la 4 dejó anotada: el
contrato OpenAPI propio de la app.

**Ningún endpoint de IA del paciente escribe. Ninguno.** No es una promesa del prompt, es la
forma del código: `servicioPaciente.ts` no importa nada que mute, y la estimación de comida se
**devuelve** en lugar de guardarse. Registrarla es una segunda llamada, a
`POST /me/meal_logs` con `origen = IA`, que el paciente dispara al confirmar. Si el modelo
alucina 900 kcal en una manzana, eso muere en la pantalla; no entra a su diario ni al
expediente que lee su nutrióloga.

**El contexto del paciente es un módulo aparte, y más pobre a propósito.**
`contextoPaciente.ts` es hermano de `contexto.ts`, no una variante suya. La diferencia es
quién lee la salida:

| Dato | Panel (`contexto.ts`) | Paciente (`contextoPaciente.ts`) |
|---|---|---|
| Objetivo, alergias, tipo de dieta, disgustos | sí | sí |
| Metas del plan | del último plan con snapshot | **solo del plan activo y compartido** |
| Edad, peso, altura, nivel de actividad | sí | no |
| Condiciones, antecedentes, medicamentos | sí | **no** |

Los últimos dos renglones son el punto. Un nutriólogo necesita la ficha clínica para juzgar un
borrador; una orientación general sobre qué desayunar no mejora porque el modelo sepa que el
paciente toma metformina, y sí empeora el riesgo si esa respuesta se muestra sin revisión. Un
test enumera las claves del contexto y falla si alguien agrega una: el módulo no puede crecer
por descuido.

**Las metas salen del plan compartido, no del último calculado.** El panel puede orientarse
con un cálculo que aún no aprueba; el coach no. Si no hay plan activo y compartido, el prompt
dice literalmente que el paciente *no tiene metas asignadas y que no se inventen cifras* — la
misma regla de §5.4 que impide mostrar ceros.

**El nombre de pila no viaja, aunque §8.3 lo permitía.** Es la única desviación deliberada del
plan en esta fase. El argumento en contra pesó más: `seudonimizarTexto` borra el nombre del
texto libre del propio paciente, así que mandarlo como campo estructurado lo reintroduciría por
la puerta de al lado, y un nombre junto a datos de salud sí es identificador. El coach habla de
tú, que era el efecto que se buscaba. Queda anotado por si se quiere revertir con criterio de
producto.

**Dos cuotas, y la del paciente no se suelta en beta.** El consumo se cobra a la cuota mensual
del nutriólogo dueño del expediente —§8.5: es quien paga la suscripción— y encima corre un tope
propio de 30 interacciones al mes por paciente. Los dos contadores viven en `ai_usage`, cada
uno bajo su `user_id`; el paciente tiene fila en `users` desde que activa su cuenta en la fase
3, así que no hizo falta tabla nueva ni migración.

Lo que sí difiere es qué se guarda en cada fila: en la del nutriólogo, generaciones **y**
tokens; en la del paciente, solo generaciones. Anotar los tokens en las dos haría que el gasto
del mes se contara doble al sumarlas.

`calcularCuotaPaciente` no tiene modo beta, y eso es intencional. La cuota de la clínica se
suelta durante la beta comercial (`limite: null`), y precisamente por eso el tope del paciente
tiene que seguir vigente: si los dos se soltaran, no quedaría nada acotando el gasto.

**Quién rechaza cambia lo que se le dice.** La reserva devuelve el motivo como valor, no como
excepción, porque "ya usaste tus 30 consultas del mes" y "la cuota de tu nutrióloga se agotó"
no son el mismo mensaje. El segundo, además, se le dice **sin cifras**: el plan del consultorio
y cuánto le queda son información comercial de otra persona. Hay un test que compara la
respuesta contra `/PRO|150|plan/` para que no se cuele.

**La guarda de alergias está en la salida, no solo en el prompt.** El sustituto propuesto se
revisa contra las alergias declaradas con `tieneConflictoAlergia` —la misma función que usa el
panel— y si menciona una, se rechaza con 422 y se deriva a la nutrióloga. No se reintenta: un
segundo intento sobre el mismo ingrediente suele reincidir, y la respuesta segura ante una
sugerencia peligrosa es no dar ninguna.

**Nada se degrada a texto.** El panel entrega un borrador malo para que el nutriólogo lo edite;
aquí no hay a quién entregárselo. Si la salida no parsea o no valida, se responde
`422 AI_INVALID_OUTPUT` con un motivo redactado para el paciente. Entregarle una salida cruda a
quien no puede juzgarla sería peor que no entregar nada.

**El coach no guarda conversación.** El historial lo conserva el cliente y viaja en el cuerpo,
acotado a 6 turnos y con los dos roles cerrados por enum —un `rol: "sistema"` sería una vía de
inyección—. Lo que un paciente le pregunta a un asistente no es expediente clínico y no tiene
por qué persistirse; y sin tabla, no hay nada que exportar ni que borrar en los derechos ARCO
de la fase 11.

**Dos límites de tasa, que resuelven cosas distintas.** El tope mensual protege el bolsillo;
`limiteDeIa` (6/min por `user_id`) protege el minuto: sin él, un cliente en bucle quema las 30
interacciones del mes en diez segundos y el paciente se queda sin asistente por un error de
programación.

**El aviso viaja en la respuesta, no en la UI.** `AVISO_IA_PACIENTE` —"Orientación general. No
sustituye a tu nutrióloga.", textual del prototipo— sale en el JSON de los tres endpoints. Si
lo pusiera cada pantalla, la primera pantalla nueva que se agregue lo va a olvidar.

**La deuda de OpenAPI de la fase 4, saldada.** `packages/servidor/src/server/me/openapi.ts`
describe los 21 endpoints y se sirve en `/api/v1/docs` de la app del paciente, apagado en
producción igual que el del panel. Es un documento **propio**, no un capítulo del otro: son dos
superficies con audiencias y sesiones distintas, y mezclarlas describiría rutas que ninguna de
las dos apps monta. Tres tests lo vigilan: que toda ruta empiece con `/api/v1/me`, que el
documento completo no contenga la cadena `patient_id` ni `nutritionist_id`, y que la cuota
publicada sea la del paciente y no la de la clínica.

**Verificación**

| Comprobación | Resultado |
|---|---|
| `npm run type-check --workspaces` | Limpio en los **5** |
| `npm run test --workspaces` | **917/917** — 93 `nutriologos` + 43 `pacientes` + 452 `servidor` + 329 `shared` |
| Tests nuevos de la fase | **90** — 21 del servicio, 14 del contexto, 12 de la doble cuota, 9 de esquemas, 7 del mapeo HTTP, 7 del OpenAPI, 7 del tope compartido, 13 de los handlers |
| Cobertura de líneas | `pacientes` 78.15 % (umbral 70), `servidor` 68.83 % (60), `nutriologos` 49.94 % (45), `shared` 99.33 % (80) |
| `npm run build:pacientes` | Build exitoso; **21 rutas** de `/api/v1/me/*` más `/api/v1/docs` y el handler de Auth.js |
| `npm run build:nutriologos` | Sin regresión |
| Suite E2E y CI | No ejecutados (fuera de alcance por instrucción) |

**Notas y deuda**

- **Ningún test llama a la API real de Anthropic**, conforme a §8 de `rules/ai-guidelines.md`:
  `generar` está mockeado en todos. Falta una prueba de humo contra el proveedor real, que
  corresponde a la fase 12 junto con los E2E.
- `rules/ai-guidelines.md` gana una sección 9 con las cuatro reglas que la IA del paciente
  endurece respecto de la del panel. El documento decía aplicar a todo
  `packages/servidor/src/server/ai/`, y esta fase agregó tres casos de uso con reglas propias.
- La app del paciente no declara `@anthropic-ai/sdk` en su `package.json`, igual que
  `nutriologos`: llega izada desde `packages/servidor`, que sí la declara y ambas apps
  consumen. Es la convención que fijó la fase 1, no un olvido.
- `packages/servidor` sube de 65.48 % a **68.83 %**. Sigue por debajo del 80 % que
  `rules/testing.md` pide al backend; el hueco son módulos de fases anteriores.
- El coach todavía no tiene pantalla: la fase 7 conecta el registro por texto y la 8 la
  sustitución de ingrediente en la vista de recetas.

### Fase 4 — API `/api/v1/me/*` ✅ (2026-07-28)

La app del paciente ya tiene backend completo: 15 endpoints montados en `apps/web/pacientes`,
todos anclados en el `patientId` que resuelve `requierePaciente`. Ninguno acepta un identificador
de paciente del cliente.

**La fase obligó a crear `apps/web/pacientes`, y eso merece explicación.** §14 daba las fases 0–5
por secuenciales, pero §2 exige que `/api/v1/me/*` se monte **solo** en la app del paciente, y
crear esa app figuraba en la fase 6. Las dos cosas no podían ser ciertas a la vez. Se resolvió
creando aquí el cascarón **estrictamente de API**:

| Creado en la fase 4 | Sigue siendo de la fase 6 |
|---|---|
| `package.json` (puerto 3001), `tsconfig.json`, `next.config.mjs`, `jest.config.mjs` | Tailwind, `@nutria/ui-tokens`, `next/font` |
| Handler de Auth.js y rutas `/api/v1/me/*` | Layout mobile-first, `BottomNav`, pantallas |
| `.env.example` propio | `manifest.webmanifest`, iconos, service worker |
| CSP y cabeceras de seguridad | `proxy.ts`, providers de React Query y Sentry |

La alternativa —dejar la lógica en `packages/servidor` sin rutas— habría entregado una fase 4 sin
un solo endpoint, que es justo lo que §14 pide como entregable. Se anotó la corrección en §14.

**Un repositorio nuevo, no un parámetro más en el existente.** `packages/servidor/src/server/me/`
es hermano de `patients/`, no una extensión suya. La diferencia es el ancla de autorización: en
`patients/repository.ts` el filtro es `nutritionistId` y el `patientId` viene de la URL; en
`me/repository.ts` el `patientId` **ya viene de la sesión** y es el único filtro. Fusionarlos
habría creado funciones donde no se sabe a simple vista cuál de los dos filtros aplica — el tipo
de ambigüedad que produce fugas entre pacientes.

**La regla que gobierna todas las lecturas: el paciente ve lo aprobado, no lo existente.**

| Recurso | Filtro |
|---|---|
| Plan alimenticio | `estado = ACTIVO` **y** `compartido_at != null` |
| Recetas | `estado = ENVIADA` (las sugeridas son borrador del nutriólogo) |
| Plan de actividad | `compartido_at != null` |
| Citas | `estado = PROGRAMADA` y `inicio >= ahora` |

Hay un test por cada uno que afirma el `where` exacto. Y tres campos se omiten deliberadamente de
las respuestas: `comentario_nutriologo` de los registros de comida, `notas` de las citas y el
`nutritionist_id` de todo. Son anotaciones del profesional sobre el paciente, no para él.

**Endpoints.** 15 rutas; las tres de `/me/ai/*` son de la fase 5.

| Ruta | Notas de diseño |
|---|---|
| `GET /me` | Metas del plan vigente; `null` si no hay plan compartido, nunca ceros (§5.4) |
| `GET /me/today` | Una llamada: plan, comidas marcadas, registros libres, agua y adherencia |
| `GET /me/meal_plan` | Devuelve `null`, no 404: no tener plan es un estado normal de la app |
| `GET /me/recipes`, `GET /me/activity_plan` | |
| `POST /me/meal_logs` | Marca del plan o registro libre; valida que la comida sea de un plan propio |
| `DELETE /me/meal_logs/{id}` | La pertenencia va en el `where` del `deleteMany` |
| `GET/POST /me/weight_logs` | `upsert` por día: volver a pesarse corrige, no duplica el punto |
| `GET/POST /me/exercise_logs` | |
| `PUT /me/water_logs` | **PUT**, no POST: la app manda el total del día |
| `GET /me/progress` | Serie de peso, tendencia y logros calculados |
| `GET/POST /me/messages` | `meta.sin_leer` viaja con el listado |
| `POST /me/messages/read` | Solo marca los del nutriólogo |
| `GET /me/appointments` | Solo lectura en V1 |
| `POST /me/photos` | `multipart/form-data`, tipo decidido por los bytes |

**El agua es PUT y eso no es cosmético.** La tarjeta del prototipo incrementa vasos de uno en uno.
Un `POST /agua/+1` sobre una red móvil se pierde o se duplica con cada reintento, y el contador
queda mal sin forma de detectarlo. Mandando el total del día, la operación es idempotente:
llegue una vez o cinco, converge al mismo valor.

**Logros calculados, no almacenados.** `packages/shared/src/logros.ts` produce los seis de §9
—racha, meta de agua, semana completa, primeros kg, peso meta y días activo— desde los registros
reales, con 20 tests de tabla. No hay columna que migrar ni estado que se desincronice cuando el
paciente registra tarde o corrige un peso. `calcularRacha` se reutiliza de `adherencia.ts` en vez
de reimplementarse, así que paciente y panel cuentan la misma racha.

El logro de peso meta avanza en la dirección que corresponda: un objetivo de ganancia de masa es
tan válido como uno de pérdida, y medir solo kilos hacia abajo dejaría a ese paciente en cero para
siempre.

**Fotos: el tipo lo deciden los bytes.** `me/fotos.ts` sigue el patrón de `profile/logoStorage.ts`.
Se ignora el `Content-Type` que declara el cliente y se lee la firma binaria (JPEG, PNG, WebP): un
SVG con script servido desde el dominio del blob sería un XSS almacenado. La ruta la construye el
servidor con el `patientId` de la sesión, el nombre es el hash del contenido —subir dos veces la
misma foto no duplica almacenamiento— y la URL que devuelve el adaptador se revalida antes de
usarse, para que un almacenamiento comprometido no pueda inyectar una dirección arbitraria.

**Límites de tasa por `user_id`, no por IP.** Todos los endpoints exigen sesión, y una red móvil
compartida o un CGNAT pondrían a decenas de pacientes tras la misma dirección. Escritura 60/min,
fotos 20/hora, según §7.

**Un hueco real del modelo, que se documenta en vez de taparse.** §7 pide que `GET /me/progress`
devuelva los kilos "faltantes", y §9 incluye un logro de peso meta. **No existe un peso objetivo
en el esquema** —se verificó: ninguna columna, ningún campo del snapshot de cálculo—. Estimarlo
desde el objetivo clínico sería inventarle una meta al paciente, justo lo que §5.4 prohíbe para
las metas calóricas. Así que `falta_kg` viaja en `null` y el logro de peso meta queda bloqueado,
con un test que lo afirma. Es un hueco del modelo del mismo tipo que los tres que resolvió la
fase 2, y hay que decidirlo con criterio clínico antes de la fase 9.

**Pruebas: la autorización se prueba una vez, sobre los 18 handlers.** El riesgo real no es que un
handler traduzca mal un 403, sino que a alguno se le olvide llamar a la guarda. `autorizacion.test.ts`
recorre los 18 puntos de entrada e invoca cada uno con sesión ausente y con rol equivocado; además
afirma que **ninguna función del repositorio se llamó**, y que la guarda se consultó exactamente
una vez por petición. Un endpoint nuevo que se olvide de la lista hace fallar el conteo.

**Verificación**

| Comprobación | Resultado |
|---|---|
| `npm install` | Workspace `pacientes` enlazado; 5 workspaces en el árbol |
| `npm run type-check --workspaces` | Limpio en los **5** |
| `npm run test --workspaces` | **827/827** — 93 `nutriologos` + 30 `pacientes` + 382 `servidor` + 322 `shared` |
| Tests nuevos de la fase | **94** — 20 de logros, 23 del repositorio del paciente, 21 de fotos, 30 de handlers (5 de autorización + 25 de comportamiento) |
| Cobertura de líneas | `pacientes` 74.35 % (umbral 70), `servidor` 65.48 % (60), `nutriologos` 49.94 % (45), `shared` 99.33 % (80) |
| `npm run build:pacientes` | Build exitoso; **15 rutas** de `/api/v1/me/*` más el handler de Auth.js |
| `npm run build:nutriologos` | Sin regresión |
| Suite E2E y CI | No ejecutados (fuera de alcance por instrucción) |

**Notas y deuda**

- **La API del paciente no está en el OpenAPI.** `packages/servidor/src/server/openapi.ts` describe
  la superficie del nutriólogo y se sirve en `/api/v1/docs` de esa app. Mezclar ahí 15 rutas que esa
  app no monta confundiría el contrato. Corresponde un documento propio en `apps/web/pacientes`,
  y se hace cuando la fase 5 cierre la superficie con los endpoints de IA.
- `jsonList` acepta ahora un `meta` extensible —el hilo de mensajes agrega `sin_leer`— conservando
  los tres campos de paginación. Es el único cambio a un módulo compartido preexistente.
- La app del paciente **no monta** `proxy.ts` todavía: sin páginas que proteger, el middleware no
  tiene qué hacer. Entra con el cascarón visual de la fase 6.
- `apps/web/pacientes/.env.example` deja explícito que **no** lleva claves de Stripe: si algún día
  aparecen ahí, es que alguien montó cobros en la app equivocada.

### Fase 3 — Identidad del paciente ✅ (2026-07-28)

El paciente ya puede tener cuenta propia: el nutriólogo lo invita desde su ficha, el token viaja
por correo y su consumo crea la cuenta y la enlaza al expediente. Con la guarda `requierePaciente`
lista, la Fase 4 puede escribir endpoints `/api/v1/me/*` sin volver a resolver identidad.

**Las dos mitades del flujo viven juntas.** `packages/servidor/src/server/auth/invitaciones.ts`
concentra emisión y consumo del token porque comparten un mismo invariante: se guarda solo el
hash, caduca a 7 días, se usa una vez y su consumo enlaza `patients.user_id`. Separarlas en dos
módulos —uno por app— habría duplicado ese contrato en dos lugares que no se leen juntos.

| Función | Qué hace |
|---|---|
| `invitarPaciente(nutritionistId, patientId)` | Valida pertenencia y precondiciones, invalida invitaciones previas y emite token |
| `activarCuentaPaciente(token, password)` | Consume el token, crea el `User` y lo enlaza, todo en una transacción |
| `requierePaciente()` | Guarda de `/api/v1/me/*`: resuelve el `patientId` en el servidor |

**Reinvitar es el camino normal, no un error.** El correo se pierde y el enlace vence, así que
cada emisión invalida las anteriores (`updateMany` sobre las `usedAt: null`) en lugar de
rechazarse. Lo que sí se rechaza con 409 es invitar a quien ya tiene cuenta: eso se resuelve
recuperando contraseña, no emitiendo un segundo acceso al mismo expediente.

**Precondiciones que bloquean la invitación**, cada una con su mensaje —el nutriólogo necesita
saber qué le falta hacer, no un "no se pudo" genérico:

| Motivo | Estado | Código |
|---|---|---|
| Paciente inexistente o de otro nutriólogo | 404 | `NOT_FOUND` |
| Ya tiene cuenta | 409 | `PATIENT_ALREADY_LINKED` |
| Expediente archivado | 422 | `PATIENT_NOT_INVITABLE` |
| Sin correo en el expediente | 422 | `PATIENT_NOT_INVITABLE` |
| Sin consentimiento de datos sensibles | 422 | `PATIENT_NOT_INVITABLE` |

El consentimiento es requisito duro: sin él no hay base legal para abrir una segunda superficie
de acceso al expediente.

**La activación es atómica, y la carrera no se resuelve leyendo primero.** Crear el usuario,
enlazarlo y quemar el token ocurren en una transacción interactiva. Los dos `updateMany` llevan
la condición en el `where` (`userId: null`, `usedAt: null`) y se comprueba el `count`: si otra
petición se adelantó —doble clic en el enlace, dos pestañas— el update no afecta filas y la
transacción se revierte entera. Comprobar antes y escribir después habría dejado una ventana
para dos cuentas sobre el mismo expediente. El `P2002` del correo se traduce a un motivo propio
(`correo_ocupado`) en vez de propagarse como 500.

**`requierePaciente` no acepta un `patient_id` del cliente, ni puede.** Devuelve el `patientId`
resuelto desde `session.user.id` a través de la relación `patientAccount`, en cada petición.
Verifica rol `END_USER`, usuario no borrado, expediente no borrado y `estado = ACTIVO`: un
paciente archivado pierde el acceso, no los datos. Los cuatro rechazos devuelven **el mismo
cuerpo** —403 `FORBIDDEN` con un solo mensaje—, y hay un test que lo afirma comparando las
respuestas: distinguirlos revelaría el estado del expediente a quien no debe conocerlo.

No se verifica `emailVerified` porque la activación lo marca en el acto: llegar ahí exige haber
abierto un enlace que solo existió en el buzón del paciente.

**El correo no lleva un solo dato clínico.** `enviarInvitacionPaciente` usa la misma plantilla y
el mismo escapado de HTML que el resto del correo al paciente, y solo menciona nombre de pila y
consultorio. El enlace apunta a la app del paciente (`PACIENTES_URL`, variable nueva,
`http://localhost:3001` en local), no al panel.

**El panel muestra el estado, no lo deduce.** El detalle del paciente incorpora `acceso_app`
(`cuenta_activa` + `invitacion_pendiente` con fechas), calculado en el servidor a partir de la
invitación vigente. No expone el `user_id` ni el hash del token. El botón "Invitar a la app" vive
en el encabezado de la ficha y cambia a "Reenviar invitación" cuando hay una pendiente; los
motivos de rechazo se muestran tal cual llegan del servidor, sin duplicar la regla en el cliente.

**La respuesta nunca incluye el token.** Si el correo no sale, se reinvita; no se copia el enlace
desde el panel. La única excepción es `enlace_activacion_dev`, que solo aparece en desarrollo sin
proveedor de correo configurado, igual que en el alta de nutriólogo.

**Lo que esta fase deja explícitamente pendiente**

- **La ruta `POST /api/v1/auth/activate` no existe todavía**, porque `apps/web/pacientes` tampoco:
  crear la app es el entregable de la Fase 6, y montarla en `nutriologos` violaría §2 (cada app
  expone solo sus endpoints). La lógica completa —`activarCuentaPaciente`— está escrita y probada;
  la Fase 6 solo tiene que envolverla en un handler con validación Zod y límite de tasa.
- **Los E2E de §6.3** (`aislamiento-pacientes.spec.ts`) y el CI quedaron fuera por instrucción
  explícita para esta fase. Ese spec necesita además la app del paciente para tener endpoints que
  probar.

**Un test intermitente, arreglado de paso.** `crypto.test.ts` › "rechaza un sobre alterado"
fallaba una de cada cuatro corridas. No era sensible al tiempo, como se sospechó en la Fase 1: el
test alteraba el **último** carácter base64 del ciphertext, y ese carácter lleva bits de relleno
que se descartan al decodificar. Cuando el último byte cifrado terminaba en `00` binario, cambiar
`A` por `B` devolvía exactamente los mismos bytes, el tag GCM seguía siendo válido y `decryptText`
no lanzaba. Ahora se altera el primer carácter del ciphertext, que siempre lleva 6 bits
significativos; 8 corridas seguidas en verde. El cifrado no se tocó: el fallo era del test.

**Verificación**

| Comprobación | Resultado |
|---|---|
| `npm run type-check --workspaces` | Limpio en los **4** workspaces |
| `npm run test --workspaces` | **733/733** — 93 en `nutriologos` (14 suites) + 338 en `servidor` (44 suites) + 302 en `shared` (18 suites) |
| Tests nuevos de la fase | **44** — 24 de invitación y activación, 10 de `requierePaciente`, 4 del serializador de acceso, 6 del botón del panel |
| Cobertura de líneas | `servidor` 65.65 % (umbral 60), `nutriologos` 49.94 % (umbral 45), `shared` 99.3 % (umbral 80) |
| `npm run build:nutriologos` | Build de producción exitoso; `/api/v1/patients/[id]/invite` registrada |
| `crypto.test.ts` en aislamiento | 8/8 corridas en verde tras el arreglo |
| Suite E2E y CI | No ejecutados (fuera de alcance de esta fase por instrucción) |

**Notas y deuda**

- `PACIENTES_URL` es variable nueva: hay que darla de alta en el proyecto de Vercel de
  `nutriologos` antes de invitar a nadie en producción. Sin ella, el enlace apunta a
  `http://localhost:3001` y la invitación llega inservible. Queda anotada para §11.
- El tope de invitaciones es por nutriólogo (30/hora), no por IP: la acción ya exige sesión y lo
  que hay que acotar es la cuenta que dispara correo hacia terceros.
- `packages/servidor` sube de 63.39 % a 65.65 % de cobertura. Sigue por debajo del 80 % que
  `rules/testing.md` pide al backend; el hueco son módulos de fases anteriores, no los de esta.

### Fase 2 — Modelo de datos ✅ (2026-07-28)

Se completó la capa de persistencia que necesita la futura app del paciente, sin adelantar
endpoints ni pantallas de las fases posteriores. Los tres cambios se dividieron por tema en
migraciones expand-only, compatibles con la versión anterior del panel.

**Registros de comida.** `meal_logs` ahora admite `calorias`, `proteina_g`, `carbos_g` y
`grasa_g` nullables para no reinterpretar registros históricos. También incorpora `hora`
nullable y `origen` con default `manual`, reutilizando el enum `content_origin`.

**Agua.** Se creó `water_logs` con un renglón único por paciente y día, contador con default 0 y
eliminación en cascada con el paciente. `food_preferences.meta_agua_vasos` tiene default 8 para
que las preferencias existentes sigan siendo válidas y el nutriólogo pueda personalizar la meta
en una fase posterior.

**Invitaciones.** Se creó `patient_invites` con hash único del token, correo, caducidad, marca de
uso y relación en cascada con el paciente. El token en claro no tiene columna y nunca se persiste.
La generación, validación y consumo transaccional del token pertenecen a la Fase 3.

**Migraciones.**

| Migración | Cambio |
|---|---|
| `20260728_phase2_01_meal_logs_macros` | Macros, calorías, origen y hora del registro libre |
| `20260728_phase2_02_water_logs` | Meta de agua y tabla de consumo diario |
| `20260728_phase2_03_patient_invites` | Invitaciones de activación con token hasheado |

**Verificación.**

| Comprobación | Resultado |
|---|---|
| `prisma validate` + generación del cliente | Esquema válido; cliente Prisma generado |
| `prisma migrate deploy` en PostgreSQL 16 desechable | **10/10 migraciones** aplicadas desde cero |
| `prisma migrate status` | *Database schema is up to date* |
| `prisma migrate diff` (base migrada vs. `schema.prisma`) | *No difference detected* |
| Repositorio de seguimiento | **14/14 tests** |
| Suite completa de `packages/servidor` | **300/300 tests**, 41 suites |
| `type-check` de workspaces | Limpio en `nutriologos`, `servidor`, `shared` y `ui-tokens` |

La base desechable se eliminó después de verificarla. Por instrucción explícita para esta fase no
se ejecutaron la suite E2E ni el pipeline de CI.

### Fase 1 — `packages/servidor` ✅ (2026-07-28)

Segundo movimiento sin cambio funcional: la capa de servidor salió de la app del nutriólogo y ahora
vive en un paquete que las dos apps web podrán consumir. **Ni una línea de lógica de servidor se
editó**; el diff de la fase es mudanza y configuración.

**Qué se movió.** 155 archivos, todos registrados por Git como renombrados (`R`), así que
`git log --follow` sigue funcionando:

| Origen | Destino |
|---|---|
| `apps/web/nutriologos/src/server/` | `packages/servidor/src/server/` |
| `apps/web/nutriologos/src/config/` | `packages/servidor/src/config/` |
| `apps/web/nutriologos/src/domain/planLimits.ts` | `packages/servidor/src/domain/planLimits.ts` |
| `apps/web/nutriologos/src/components/pdf/` | `packages/servidor/src/components/pdf/` |
| `apps/web/nutriologos/src/types/next-auth.d.ts` | `packages/servidor/src/types/next-auth.d.ts` |
| `apps/web/nutriologos/prisma/` | `packages/servidor/prisma/` |
| `apps/web/nutriologos/scripts/` | `packages/servidor/scripts/` |

**El hallazgo que definió el layout.** §4.1 daba por hecho que `src/server` era autocontenido y
podía aplanarse en `packages/servidor/src/`. No lo era: 13 archivos de servidor importan cuatro
cosas de fuera —`@/config/privacy`, `@/config/brandLogo`, `@/domain/planLimits` y
`@/components/pdf/MealPlanDocument`—. Aplanar habría obligado a reescribir esos imports (y a
duplicar las constantes en la app del paciente).

La salida fue **replicar dentro del paquete el layout que las carpetas tenían en la app**
(`src/server/…`, `src/config/…`, `src/domain/…`, `src/components/pdf/…`). Con eso:

- ningún import cambia;
- el paquete se type-checkea aislado, con un solo `paths` propio (`"@/*": ["./src/*"]`);
- cada app necesita una sola regla, con respaldo ordenado, en vez de una por carpeta:

```json
"paths": { "@/*": ["./src/*", "../../../packages/servidor/src/*"] }
```

El orden da además una escotilla útil: si una app necesita su propia versión de un módulo
compartido, la pone en su `src` y gana. `agendaFormato.ts` —el otro archivo de `src/domain`, que
depende de `@/services`— se quedó en la app, que es donde pertenece.

`transpilePackages: ['@nutria/servidor']` resultó innecesario: el alias apunta a una ruta relativa,
no a `node_modules`, así que Next compila esos archivos como código fuente de la app. El paquete sí
se declara como dependencia para que npm lo enlace y `--workspaces` lo recorra.

**Ampliación de módulo de Auth.js.** `next-auth.d.ts` viajó con la configuración de sesión, pero un
`.d.ts` solo surte efecto si forma parte del programa, y los alias no lo arrastran: sin él,
`tsc` reventaba con siete errores en `auth/config.ts`. Cada app lo agrega explícitamente a su
`include`.

**Jest.** `packages/servidor` no puede usar `next/jest`: ese preset aborta con *"Couldn't find any
`pages` or `app` directory"* porque el paquete no es una app de Next. Se transpila con **ts-jest**,
igual que `packages/shared`, apuntando el `dir` a sí mismo. Se evaluó `nextJest({ dir: '../../apps/
web/nutriologos' })`, pero invertía la dependencia —el paquete compartido dependiendo de una app—,
justo lo que la fase busca romper. `ts-jest` ya estaba en el árbol, así que no se agregó ninguna
dependencia nueva.

**Cobertura: se reatribuye, no se pierde.** Al salir el servidor, `apps/web/nutriologos` cayó de
~60 % a **49.05 %** de líneas y su umbral de 60 dejaba de pasar. No se dejó de probar nada: el
código y sus tests se contabilizan ahora donde viven. Se ajustaron los umbrales y se documentó el
cambio en `rules/testing.md`:

| Workspace | Cobertura de líneas | Umbral |
|---|---|---|
| `apps/web/nutriologos` (solo UI) | 49.05 % | 45 |
| `packages/servidor` | 64.28 % | 60 |
| `packages/shared` | 99.3 % | 80 |

`packages/servidor` debe llegar a 80 —lo que `rules/testing.md` exige al backend— conforme entren
los tests de las fases 2 a 5. Subirlo ahora sería trabajo distinto al de esta fase.

**Scripts de base de datos: se movieron los archivos, no los comandos.** §4.3 los mandaba a
`packages/servidor/package.json`, pero el CLI de Prisma solo lee un `.env` del directorio desde el
que corre, y el `.env` local vive en la app porque Next también lo necesita en tiempo de ejecución.
Ponerlos en el paquete habría obligado a duplicar `DATABASE_URL` en dos archivos. Se quedaron en
`apps/web/nutriologos/package.json` apuntando al paquete con `--schema
../../../packages/servidor/prisma/schema.prisma`, que además coincide con §11: solo `nutriologos`
corre migraciones. El `package.json` raíz expone `db:migrate`, `db:deploy`, `db:status` y `db:seed`
como atajos.

**Dependencias.** Salieron de la app las que dejó de importar del todo (`@anthropic-ai/sdk`,
`@auth/prisma-adapter`, `@react-pdf/renderer`, `@upstash/*`, `@vercel/blob`, `resend`,
`zod-openapi`). `@prisma/client`, `bcryptjs`, `next-auth`, `stripe` y `zod` quedan declaradas en
ambos porque ambos las importan; npm las resuelve a una sola copia izada.

**Otros ajustes de configuración**

| Archivo | Cambio |
|---|---|
| `apps/web/nutriologos/playwright.config.ts` | La guarda `validarBaseE2E` se importa por ruta relativa explícita; Playwright carga su config sin pasar por los alias de tsconfig |
| `.github/workflows/ci.yml` | Los 4 pasos de Prisma (`validate`, `migrate deploy` ×2, `migrate diff`) cambian a `working-directory: packages/servidor`; los de Playwright y `db:seed` se quedan en la app |
| `rules/ai-guidelines.md`, `.env.example`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `skills/deploy/deploy-config.md`, `e2e/utils/correo.ts` | Rutas y estructura del monorepo |

**Verificación**

| Comprobación | Resultado |
|---|---|
| `npm install` | Enlace `node_modules/@nutria/servidor` creado; `postinstall` genera el cliente de Prisma con el esquema compartido |
| `npm run type-check --workspaces` | Limpio en los **4** workspaces |
| `npm run test --workspaces -- --coverage` | **689/689** — 87 en `nutriologos` (13 suites) + 300 en `servidor` (41 suites) + 302 en `shared` (18 suites). Mismo total que la fase 0: los 300 que salieron de la app son exactamente los que entraron al paquete |
| `npm run build:nutriologos` | Build de producción exitoso, con todas las rutas de `/api/v1` y del panel |
| `npm run db:status` | `.env` de la app leído, esquema compartido resuelto, 7 migraciones, *Database schema is up to date* |
| Playwright: carga de config | La config resuelve y ejecuta la guarda importada del paquete |
| Suite E2E completa | ❌ **No pasa** — ver abajo |

**El gate de E2E de §4.4 NO se cumplió.** Queda pendiente y es lo primero que hay que resolver
antes de la fase 2.

Tres corridas contra Postgres desechable en Docker:

| Corrida | Modo | Base | Resultado |
|---|---|---|---|
| 1 | `next dev` | sembrada | 23 pasan / 15 fallan (17.1 min) |
| 2 | `next start` (build de producción, igual que CI) | recreada desde cero | ~16 pasan / 22 fallan |
| 3 | `next start`, solo `calculo-clinico.spec.ts` | recreada desde cero | los 7 agotan el timeout |

**Todos los fallos tienen la misma firma**: `page.waitForURL('**/pacientes')` agota 60 s después
del clic en "Iniciar sesión", con `[auth][error] CredentialsSignin` en el servidor. Es decir, el
login devuelve credenciales inválidas.

Lo que **sí** se descartó:

- *No es resolución de módulos.* Si el alias `@/server/*` estuviera mal, no arrancaría el servidor
  ni pasaría un solo test; en la corrida 1 pasaron 23, varios de los cuales inician sesión.
- *No es compilación lenta de `next dev`.* Falla igual contra el build de producción.
- *No es estado acumulado ni límite de tasa.* `calculo-clinico` falla completo aun corriendo solo,
  con servidor nuevo y base recién creada.
- *No es base sucia.* Se recreó (`DROP DATABASE … WITH (FORCE)`) y resembró antes de las corridas
  2 y 3.

**Causa raíz, encontrada después del commit.** No es regresión de esta fase: es el propio arnés de
E2E chocando contra un control de seguridad de producción.

`authorize()` (`packages/servidor/src/server/auth/index.ts`) limita el login a **15 intentos por IP
cada 15 minutos**:

```ts
rateLimit(`login:source:${ipDe(request)}`, 15, 15 * 60 * 1000)
```

La suite hace **34 llamadas a `iniciarSesion`** —más los reintentos— todas desde `127.0.0.1` y
contra un solo proceso de servidor. Sin `UPSTASH_*` configurado el limitador es en memoria, así que
el contador se acumula durante toda la corrida. A partir del login 16, `authorize()` devuelve
`null`; el cliente recibe `CredentialsSignin`, la página nunca navega y `waitForURL` agota sus 60 s.

Encaja con todo lo observado: en `next dev` (lento) la ventana de 15 minutos alcanzaba a renovarse
a media corrida y pasaban 23 tests; en modo CI, más rápido, cabían más logins dentro de la misma
ventana y fallaban más. Y explica que los specs afectados cambien entre corridas: depende de
cuántos logins se hayan gastado antes de llegar a cada uno.

**Descartada la regresión, con prueba.** Se comparó byte a byte cada uno de los **155 archivos
movidos** contra `cd6dfbc` (el commit anterior a esta fase):

```
comparados: 155 | con diferencias: 0
```

Incluye toda la ruta de login (`auth/index.ts`, `auth/config.ts`, `auth/password.ts`,
`rate-limit.ts`, `db.ts`). La fase 1 no pudo introducir este fallo. Es deuda preexistente,
probablemente desde que la fase 8 del plan V2 agregó los límites de tasa: el CI dejó de llegar al
paso de E2E —falla antes en `npm audit`— así que la suite se rompió sin que nadie lo viera.

**Pendiente de decidir cómo arreglarlo** (toca un control de seguridad, no se cambia a la ligera).

**Notas y deuda**

- Se corrigieron en el propio plan §4.1, §4.2, §4.3, §6.2 y §8: describían rutas
  (`packages/servidor/src/auth/guards.ts`, `packages/servidor/src/ai/config.ts`) que el layout
  replicado invalida. Ahora dicen `src/server/…`.
- `npm audit --audit-level=high` sigue reportando 21 vulnerabilidades altas, todas transitivas de
  `jest`. Vienen de antes de la fase 0 y hacen fallar el paso "Auditar dependencias" del CI. Se
  atiende aparte.
- En una corrida de `npm run test --workspaces -- --coverage` se vio **un** test de `servidor`
  fallar y no se reprodujo en las cuatro corridas siguientes (con y sin cobertura). Queda anotado
  como sospecha de test sensible al tiempo; si reaparece, hay que aislarlo.
- El catálogo de alimentos de USDA y Open Food Facts no está en el árbol local, así que el seed
  siembra solo los 157 alimentos del núcleo mexicano. Es igual que antes de la fase.

### Fase 0 — Reorganización del monorepo ✅ (2026-07-28)

Movimiento puro: el panel del nutriólogo quedó en `apps/web/nutriologos` sin un solo cambio de
comportamiento. Ninguna línea de la app del paciente todavía.

**Mudanza.** `git mv apps/web apps/web-tmp` → `git mv apps/web-tmp apps/web/nutriologos`, con el
rodeo por `web-tmp` previsto en §3.1. Git registró **345 archivos como renombrados** (`R`), así que
`git log --follow` sigue funcionando en todos. Antes de mover se borraron `.next/`, `.swc/`,
`node_modules/` y `test-results/` (regenerables). El `.env` local viajó con el directorio.

Un dev server de Next quedado de una sesión anterior (PIDs 28076/33644/30152) bloqueaba el
directorio y hacía fallar el `git mv` con *Permission denied*; se detuvo antes de mover.

**Configuración del monorepo.**

| Archivo | Cambio |
|---|---|
| `package.json` (raíz) | `workspaces: ["apps/*"]` → `["apps/web/*"]` — con `apps/web` ya sin `package.json`, el glob viejo rompe `npm install`. Scripts nuevos `dev:nutriologos` / `build:nutriologos`; `dev:web` y `build:web` quedan como alias temporales |
| `apps/web/nutriologos/package.json` | `"name": "web"` → `"nutriologos"` |
| `.github/workflows/ci.yml` | 9 rutas: `working-directory`, `--workspace` y el artefacto de Playwright |

**Rutas relativas que subían un nivel de más** (el nivel extra de directorio las rompía en silencio):

| Archivo | Antes | Después |
|---|---|---|
| `next.config.mjs` | `outputFileTracingRoot: '../../'` | `'../../../'` |
| `tsconfig.json` | `extends: '../../tsconfig.base.json'` | `'../../../…'` |
| `jest.config.mjs` | `moduleNameMapper` a `../../packages/…` | `../../../packages/…` |

`playwright.config.ts` y `tailwind.config.ts` no necesitaron cambios: solo usan rutas relativas a
su propio directorio.

**Documentación actualizada** (rutas y comandos, no contenido): `README.md`, `CLAUDE.md`,
`AGENTS.md`, `rules/ai-guidelines.md`, `rules/code-style.md`, `rules/testing.md`,
`skills/deploy/deploy-config.md`, `commands/fix-issue.md`, `MVP/app-web/GUIA-CONFIGURAR-STRIPE.md`.

**Verificación**

| Comprobación | Resultado |
|---|---|
| `npm install` | Enlace de workspace `node_modules/nutriologos` creado; sin `web` huérfano |
| `npm run type-check --workspaces` | Limpio en los 3 workspaces |
| `npm run test --workspaces` | **689/689** — 387 en `nutriologos` (54 suites) + 302 en `shared` (18 suites). Idéntico al total registrado en la fase 8 del plan V2: no se perdió ni se dejó de ejecutar ningún test |
| `npm run build:nutriologos` | Build de producción exitoso, con todas las rutas de `/api/v1` y del panel |
| `npx playwright test --list` | **38 tests en 10 archivos** descubiertos; la config resuelve tras el movimiento |
| Servidor de desarrollo | `/api/v1/health` → 200 con `base_de_datos: "ok"`; `/login` → 200; `/inicio` → 307 a login sin sesión |

La suite E2E completa **no** se ejecutó: Docker Desktop estaba apagado y esa corrida es el gate de
la Fase 1 (§4.4), no de la 0. El `--list` cubre lo que la Fase 0 podía romper (resolución de config
y `testDir`).

**Notas y deuda**

- `apps/web/nutriologos/src/server/plans/repository.ts` y su test aparecen modificados en el árbol
  de trabajo, pero **no son de esta fase**: venían sin commitear de la sesión del 2026-07-24
  (timeout de transacciones de planes).
- `next-env.d.ts` cambia solo porque Next lo regenera distinto según se haya corrido `next dev` o
  `next build` al último. Es un archivo generado.
- `npm audit --audit-level=high` reporta 21 vulnerabilidades altas, todas transitivas de `jest`
  (`babel-plugin-istanbul` y compañía). Son **previas** a esta fase — el árbol de dependencias no
  cambió — pero el paso "Auditar dependencias" del CI falla por ellas. Se atiende aparte.
- Referencias a `apps/web` que se dejaron a propósito: `MVP/app-web/PLAN-V2-PRODUCCION.md` y
  `SECURITY-AUDIT-FASE-8.md` son bitácoras históricas; reescribirlas falsearía el registro.
  Igual se dejaron los comentarios genéricos en `packages/shared` y `packages/ui-tokens`, que se
  actualizarán en la Fase 1 cuando ya existan las dos apps.
