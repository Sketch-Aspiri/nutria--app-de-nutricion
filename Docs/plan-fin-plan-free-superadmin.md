# Plan: eliminar plan Free + activación manual por Superadmin

## Contexto

Hoy el negocio corre en modo freemium (`BILLING_MODE=beta`): toda cuenta nueva recibe plan `FREE` sin límites de uso, y Stripe está completamente integrado (checkout, portal, webhooks, entitlements) pero deliberadamente bloqueado en beta. El plan es vender directo, fuera de Stripe, a un grupo cercano de nutriólogas mientras el negocio no escala: cada nutrióloga se registra, recibe automáticamente **1 mes de acceso Pro gratis**, y si al terminar ese mes no ha pagado (efectivo, depósito, etc.), pierde acceso hasta que **tú, como superadmin**, la actives manualmente desde un panel nuevo. Cada activación cubre **1 mes** (ciclo mensual manual, no indefinido) y siempre asigna plan **Pro**. Stripe queda intacto para cuando el negocio escale — no se toca ni se apaga, simplemente no se usa todavía.

Decisiones ya confirmadas:
- Activación = ciclos mensuales (no indefinida).
- Todas las nutriólogas activadas van a plan Pro (Clínica queda para después).
- **Se quitan los límites ilimitados del modo beta**: a partir de ahora aplican los topes reales del plan Pro (150 generaciones de IA al mes; pacientes, plantillas y PDF con marca propia ya son ilimitados/incluidos en Pro por catálogo, así que el cambio de fondo es que la cuota de IA empieza a contarse de verdad).
- Las cuentas ya registradas hoy **no** se dan por activadas automáticamente: quedan con la misma regla que las nuevas (1 mes de gracia desde su `createdAt` original), así que si alguna nutrióloga piloto ya lleva más de un mes registrada, quedará bloqueada apenas se despliegue este cambio hasta que la actives manualmente. Esto es intencional — conviene activarlas justo después de desplegar.

**Importante — desacoplar límites de checkout:** hoy `BILLING_MODE` hace dos cosas a la vez: (1) desactiva los topes de uso (`calcularEntitlements` en `packages/shared/src/suscripcion/planes.ts`, `calcularCuota` en `packages/shared/src/ia/limites.ts`) y (2) bloquea el checkout de Stripe (`crearSesionCheckout` en `packages/servidor/src/server/billing/servicio.ts`, vía `esBeta()`). Si solo cambiara `BILLING_MODE` a `produccion` para activar los límites reales, como efecto secundario también se destaparía el checkout de Stripe — y Stripe todavía no debe habilitarse. Por eso el plan separa ambas cosas explícitamente (ver punto 3.1).

## Diseño

### 1. Modelo de datos (`packages/servidor/prisma/schema.prisma`)

- `UserRole`: agregar `SUPERADMIN`.
- `Subscription`: agregar campos
  - `accessExpiresAt DateTime` — única fuente de verdad de "hasta cuándo tiene acceso". Se fija en `createdAt + 1 mes` al registrarse; cada activación manual la vuelve a poner en `ahora + 1 mes`.
  - `lastActivatedAt DateTime?`, `lastActivatedByUserId String?` (relación a `User`) — auditoría de quién activó y cuándo.
  - `activationNote String?` — nota libre opcional (ej. "depósito BBVA 15/08").
  - `plan` cambia su default de `FREE` a `PRO`. El enum `SubscriptionPlan` **no** se toca (se deja `FREE` definido para no arriesgar una migración de drop de enum; simplemente deja de asignarse — ver nota de limpieza futura al final).
- Migración (expand-contract, en una sola migración porque son pocas filas piloto):
  1. Agregar columnas nuevas (nullable) y el valor de enum `SUPERADMIN`.
  2. Backfill SQL: `accessExpiresAt = "createdAt" + interval '1 month'` para toda fila existente de `Subscription`; `plan = 'PRO'` donde `plan = 'FREE'`.
  3. Alterar `accessExpiresAt` a `NOT NULL` tras el backfill.

### 2. Lógica de negocio pura (`packages/shared/src/suscripcion/activacion.ts`, nuevo)

```ts
export type EstadoCuenta = 'ACTIVA' | 'BLOQUEADA';
calcularEstadoCuenta(accessExpiresAt: Date, ahora = new Date()): EstadoCuenta
calcularExpiracionInicial(fechaRegistro: Date): Date       // fechaRegistro + 1 mes
calcularNuevaExpiracionAlActivar(ahora = new Date()): Date // ahora + 1 mes
```

Con tests en `activacion.test.ts` (frontera exacta del mes, ya vencida, recién activada). Sigue el patrón ya usado en `packages/shared/src/suscripcion/planes.ts` — no se toca el código de `calcularEntitlements`/`calcularCuota` (esa lógica ya está bien implementada); lo único que cambia es la variable de entorno `BILLING_MODE`, ver punto 3.1.

### 3. Registro de nutriólogas (`packages/servidor/src/server/auth/provisioning.ts`)

`asegurarCuentaNutriologo`: en el `create` del upsert de `Subscription`, fijar `plan: 'PRO'` y `accessExpiresAt: calcularExpiracionInicial(ahora)` en vez de dejar los defaults de schema actuar solos. El resto del flujo de registro (verificación de email, notificación interna) no cambia.

### 3.1. Activar límites reales de Pro sin destapar Stripe

- **Config**: fijar `BILLING_MODE=produccion` en el entorno de `apps/web/nutriologos` (Vercel). Esto ya hace que `calcularEntitlements()` y `calcularCuota()` dejen de dar acceso ilimitado y apliquen el catálogo real (150 generaciones de IA/mes para Pro; pacientes, plantillas y marca blanca ya son ilimitados/incluidos en Pro, así que no cambian). No requiere tocar código de `packages/shared`, esa lógica ya está implementada y probada.
- **Código** (`packages/servidor/src/server/billing/servicio.ts`): `crearSesionCheckout` hoy bloquea con `esBeta()`. Cambiar el gate a `!stripeConfigurado()` (ya existe esa función en `config.ts`, hoy sin usar para esto) — así el checkout se queda bloqueado mientras no haya `STRIPE_SECRET_KEY` configurada, sin depender de `BILLING_MODE`. Actualizar el mensaje de `FacturacionNoDisponibleError` (motivo actualmente `'BETA'`) para que diga algo acorde a esta etapa, ej. "Los pagos en línea todavía no están disponibles; contáctanos para activar o renovar tu cuenta." Revisar los usos del motivo `'BETA'` en el frontend (`(panel)/suscripcion/page.tsx` y similares) para que el copy coincida.
- Resultado: las nutriólogas activadas manualmente sí quedan sujetas al tope real de 150 generaciones de IA al mes de Pro, pero nadie puede iniciar un checkout de Stripe hasta que se configure `STRIPE_SECRET_KEY` cuando el negocio escale.

### 4. Gating de acceso (bloquear login cuando venció el mes sin activación)

Se sigue el mismo patrón de doble capa que ya usa `emailVerificado` en este repo:

- **`packages/servidor/src/server/auth/guards.ts`** — `requiereNutriologo()`: tras el chequeo de `emailVerified`, si `usuario.role === 'NUTRITIONIST'`, releer `Subscription.accessExpiresAt` fresco de la BD y calcular estado con `calcularEstadoCuenta`. Si `BLOQUEADA`, responder 403 con un nuevo `ErrorCode.ACCOUNT_INACTIVE` (mensaje genérico, mismo criterio que ya usan para no filtrar motivo). `ADMIN`/`SUPERADMIN` quedan exentos de este chequeo (no son cuentas de clientes).
- **`packages/servidor/src/server/auth/config.ts`** — callback `jwt()`: agregar `token.cuentaActiva` (boolean), calculado igual que `emailVerificado` en el sign-in inicial. Callback `authorized()`: si la ruta es del panel y `!token.cuentaActiva`, redirigir a `/cuenta-inactiva`. Es un chequeo "grueso" en edge (puede quedar stale dentro de la ventana de 8h de sesión, igual que ya acepta el patrón de `emailVerificado`); la autoridad real sigue siendo el guard de API y el layout server-side.
- **`packages/servidor/src/types/next-auth.d.ts`**: agregar `cuentaActiva` a los tipos de `Session`/`JWT`.
- **`apps/web/nutriologos/src/app/(panel)/layout.tsx`**: agregar el mismo chequeo server-side (Node, con Prisma) que ya hace para `emailVerificado`, redirigiendo a `/cuenta-inactiva`.
- **`apps/web/nutriologos/src/app/cuenta-inactiva/page.tsx`** (nuevo): página que explica que el mes de acceso terminó y da datos de contacto para pagar y reactivar — mismo patrón visual que `/verificar`.

### 5. Rol y panel de Superadmin

- **`guards.ts`**: nuevo `requiereSuperAdmin()`, mismo patrón que `requiereNutriologo()`/`requierePaciente()`, exige `role === 'SUPERADMIN'`.
- **Rutas**: nuevo route group `apps/web/nutriologos/src/app/(superadmin)/superadmin/` con su propio `layout.tsx` que valida sesión + rol server-side (igual patrón que `(panel)/layout.tsx`).
  - `superadmin/nutriologas/page.tsx`: tabla con todas las `User` de rol `NUTRITIONIST` — nombre, email, fecha de registro, plan, estado (Activa/Bloqueada + fecha de expiración), etiqueta "primer mes gratis" si `lastActivatedByUserId` es null, botón **"Activar 1 mes"** por fila, y campo opcional de nota de pago.
- **API** (protegidas con `requiereSuperAdmin()`):
  - `apps/web/nutriologos/src/app/api/v1/admin/nutritionists/route.ts` — GET, lista con estado calculado.
  - `apps/web/nutriologos/src/app/api/v1/admin/nutritionists/[id]/activate/route.ts` — POST, fija `accessExpiresAt = calcularNuevaExpiracionAlActivar(ahora)`, `lastActivatedAt = ahora`, `lastActivatedByUserId = sesion.user.id`, `plan: 'PRO'`, `activationNote` opcional del body.
- **`packages/servidor/src/server/billing/repository.ts`**: el comentario actual dice "solo el webhook de Stripe escribe en `subscriptions`". Agregar una nota indicando que la activación manual del superadmin es la segunda escritura sancionada, deliberada, y auditada (vía `lastActivatedByUserId`).
- **`apps/web/nutriologos/src/proxy.ts`** / config de rutas del middleware: registrar el prefijo `/superadmin` con su propia regla de `authorized` (sin sesión → `/login`; sesión sin rol superadmin → su panel normal `/inicio`).

### 6. Convertirte en Superadmin

No hay alta de superadmin por registro público. Nuevo script `packages/servidor/scripts/promote-superadmin.ts` que recibe un email y hace `prisma.user.update({ where: { email }, data: { role: 'SUPERADMIN' } })`. Se documenta el comando exacto para correrlo una sola vez contra la base de datos real, sobre tu propia cuenta (`aspiriandres97@gmail.com`).

### 7. UI de suscripción existente

`apps/web/nutriologos/src/app/(panel)/suscripcion/page.tsx` y `components/suscripcion/TarjetaPlan.tsx`: quitar cualquier mención/tarjeta del plan Free. Mientras Stripe siga sin `STRIPE_SECRET_KEY` configurada (ver 3.1), mostrar el plan Pro actual + fecha de expiración de acceso + uso real de IA del mes ("Tu acceso está activo hasta el [fecha]. Llevas X/150 generaciones de IA este mes. Para renovar, contáctanos.") en vez del flujo de checkout.

### 8. Tests

- `packages/shared/src/suscripcion/activacion.test.ts` (nuevo).
- Tests de `guards.ts` para la nueva rama de `requiereNutriologo()` y para `requiereSuperAdmin()`.
- Extender `apps/web/nutriologos/e2e/suscripcion.spec.ts` (o nuevo spec): registro → mes de prueba activo → simular vencimiento → bloqueado → superadmin activa desde el panel → acceso restaurado.

### 9. Documentación

Actualizar `MVP/app-web/PLAN-V2-PRODUCCION.md` sección 9 para reflejar el modelo interino de activación manual y la existencia del rol `SUPERADMIN`, dejando claro que Stripe sigue siendo el plan a futuro cuando se escale.

### Nota de limpieza futura (no en este plan)

El valor `FREE` del enum `SubscriptionPlan` se queda definido en la BD pero sin uso — quitarlo del todo requeriría una migración de enum aparte una vez confirmado que ninguna fila lo usa. No se hace ahora para no arriesgar la migración inicial.

## Verificación

1. Correr la migración de Prisma en local y confirmar que `accessExpiresAt` y `plan` quedan bien poblados en filas existentes de prueba.
2. Registrar una nutrióloga nueva de prueba → confirmar `Subscription.plan = 'PRO'` y `accessExpiresAt ≈ ahora + 1 mes`.
3. Forzar `accessExpiresAt` al pasado en una fila de prueba → confirmar que el login/panel redirige a `/cuenta-inactiva` y que el endpoint `/api/v1/...` devuelve 403 `ACCOUNT_INACTIVE`.
4. Promover tu usuario a `SUPERADMIN` con el script, entrar a `/superadmin/nutriologas`, activar la cuenta bloqueada del paso 3, y confirmar que recupera acceso de inmediato en la capa de guard (y tras refrescar sesión en el middleware edge).
5. Confirmar que una nutrióloga con rol distinto a `NUTRITIONIST` (o un usuario `END_USER` de la app de pacientes) no puede entrar a `/superadmin`.
6. Con `BILLING_MODE=produccion`, confirmar que una cuenta Pro activa ve el tope real de 150 generaciones de IA/mes (`calcularEntitlements`/`useSuscripcion`) y que, sin `STRIPE_SECRET_KEY` configurada, intentar iniciar un checkout devuelve el error de "pagos no disponibles" en vez de 500 o de destapar Stripe.
7. Correr `npm run test` en `packages/shared` y `packages/servidor`, y el nuevo/actualizado E2E en `apps/web/nutriologos`.
