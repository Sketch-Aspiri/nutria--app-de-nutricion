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

## 5. Fase 2 — Modelo de datos que falta

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

## 6. Fase 3 — Identidad del paciente

### 6.1 Flujo

1. El nutriólogo abre la ficha del paciente → **"Invitar a la app"**. Requiere `patients.email`
   y consentimiento de datos sensibles ya registrado (`sensitive_data_consent_at`).
2. `POST /api/v1/patients/{id}/invite` (app nutriólogos) crea el `PatientInvite` y envía correo con
   `https://mi.nutria.mx/activar?token=…`.
3. El paciente abre el enlace, ve el aviso de privacidad (`src/config/privacy.ts`) y define contraseña.
4. `POST /api/v1/auth/activate` (app pacientes): valida token → crea `User` con `role = END_USER`,
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

## 7. Fase 4 — API v1 del paciente

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

## 8. Fase 5 — IA del paciente

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

### Fase 6 — Cascarón, PWA e identidad visual

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

### Fase 7 — Hoy y registro

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
| 2 | Modelo de datos | Migraciones de `meal_logs`, `water_logs`, `patient_invites` | 1 |
| 3 | Identidad del paciente | Invitación, activación, `requierePaciente` | 2 |
| 4 | API `/api/v1/me/*` | Endpoints con tests de integración | 3 |
| 5 | IA del paciente | Coach, estimación, sustitución, con cuotas y guardas | 4 |
| 6 | Cascarón y PWA | App navegable e instalable | 3 |
| 7 | Hoy y registro | Pantalla principal completa | 4, 5, 6 |
| 8 | Plan y recetas | Plan y recetas compartidas | 4, 6 |
| 9 | Progreso y logros | Gráfica y logros calculados | 4, 6 |
| 10 | Mensajes | Chat real bidireccional | 4, 6 |
| 11 | Perfil y ARCO | Cuenta, privacidad, exportación y baja | 4, 6 |
| 12 | E2E y despliegue | 8 specs en verde, dos proyectos en Vercel | 7–11 |

Las fases 0 a 5 son secuenciales. De la 7 a la 11 son independientes entre sí una vez lista la 6.

---

## 15. Bitácora

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

Lo que **no** se pudo descartar, y por qué:

- **No hay línea base verde con la cual comparar.** La fase 0 no llegó a correr los E2E (Docker
  apagado) y el CI viene fallando en el paso `npm audit`, que corre **antes** del paso de E2E: la
  suite no se ejecuta en CI desde hace días. No se puede afirmar si estos fallos son anteriores a
  la fase 1 o los introdujo.
- Los specs que fallan **cambian entre corridas** (`agenda` y `aislamiento-datos` pasan en la 1 y
  fallan en la 2), lo que apunta a sensibilidad de tiempo o de recursos de la máquina, no a un
  defecto determinista. Pero `calculo-clinico` falla completo en las tres.

Siguiente paso sugerido: reproducir contra el commit anterior a esta fase (`cd6dfbc`) para
determinar si es regresión o deuda preexistente, y en cualquier caso instrumentar `authorize()`
para ver por qué rechaza las credenciales, en lugar de seguir infiriendo desde el timeout.

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
