# Guía para configurar Stripe (fase 7)

Todo el código ya está listo. Esto es lo que **tú** tienes que hacer, y en qué orden.

> **Antes de empezar: no hace falta nada de esto para seguir usando la app.**
> Con `BILLING_MODE=beta` (el valor por omisión) todas las cuentas son Free y sin
> límites: pacientes, plantillas y generaciones de IA ilimitadas, y PDF con tu
> marca incluido. La página **Suscripción** muestra los planes como
> "próximamente". Puedes hacer los pasos 1–6 tranquilamente y activar el cobro
> (paso 7) cuando termine el piloto.

---

## Paso 1 — Crear la cuenta de Stripe

1. Entra a <https://dashboard.stripe.com/register> y crea la cuenta.
2. Elige **México** como país del negocio y **MXN** como moneda.
3. Deja el interruptor de arriba a la derecha en **modo de prueba** (*Test mode*)
   hasta el paso 7. En modo de prueba nada cobra dinero real.

No necesitas completar la activación de la cuenta (datos fiscales, RFC, cuenta
bancaria) para probar. Sí la necesitas antes de cobrar de verdad.

## Paso 2 — Crear los productos y precios

En **Product catalog → Add product**, crea tres productos. Para cada uno marca el
precio como **Recurring** (recurrente) y la moneda **MXN**.

| Producto | Precio | Periodo |
|---|---|---|
| `nutria Pro` | 499.00 MXN | Mensual |
| `nutria Pro` (segundo precio en el mismo producto) | 4,990.00 MXN | Anual |
| `nutria Clínica` | 1,299.00 MXN | Mensual |

> Pro lleva **dos precios dentro del mismo producto** (uno mensual y uno anual),
> no dos productos distintos. En la ficha del producto ya creado usa
> **Add another price**.

Al terminar, copia los tres identificadores de precio. Empiezan con `price_...`
y se ven en la ficha de cada precio (**Pricing → el precio → API ID**).

Los 14 días de prueba de Pro **no** se configuran aquí: los pone la app al abrir
el checkout, tomándolos del catálogo en el código.

## Paso 3 — Activar Stripe Tax (IVA)

1. Ve a **More → Tax** (o <https://dashboard.stripe.com/tax>).
2. Activa Stripe Tax y registra tu obligación fiscal en México.
3. En **Tax → Settings**, deja los precios como **inclusive** o **exclusive**
   según cómo quieras mostrarlos. Si los pusiste como "499 MXN al público",
   elige **inclusive**.

Sin esto el checkout funciona igual, pero cobrará sin IVA.

## Paso 4 — Copiar las llaves de API

En **Developers → API keys** copia la **Secret key** (empieza con `sk_test_...`
en modo de prueba).

Nunca la pegues en el código ni la subas al repositorio. Solo va en `.env` local
y en las variables de entorno de Vercel.

## Paso 5 — Llenar el `.env` local

En `apps/web/nutriologos/.env` (créalo copiando `apps/web/nutriologos/.env.example` si aún no existe):

```bash
BILLING_MODE=beta
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_PRO_MENSUAL=price_...
STRIPE_PRICE_PRO_ANUAL=price_...
STRIPE_PRICE_CLINICA_MENSUAL=price_...
APP_URL=http://localhost:3000
```

`STRIPE_WEBHOOK_SECRET` lo obtienes en el paso siguiente.

## Paso 6 — Probar el flujo completo en local

Necesitas la CLI de Stripe para que los webhooks lleguen a tu máquina.

1. **Instala la CLI**: en Windows, con winget:

   ```powershell
   winget install Stripe.StripeCLI
   ```

   (Alternativas y otros sistemas: <https://docs.stripe.com/stripe-cli>.)

2. **Inicia sesión** (abre el navegador para autorizar):

   ```bash
   stripe login
   ```

3. **Escucha los eventos** y redirígelos a la app. Deja esta terminal abierta:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   Imprime una línea como `Your webhook signing secret is whsec_...`. **Copia ese
   `whsec_...` a `STRIPE_WEBHOOK_SECRET` en `apps/web/nutriologos/.env`.** Es distinto del
   secreto de producción; cada endpoint tiene el suyo.

4. **Pon el cobro en marcha temporalmente** para poder probarlo. En `.env`:

   ```bash
   BILLING_MODE=produccion
   ```

5. **Levanta la app** en otra terminal:

   ```bash
   cd apps/web/nutriologos && npm run dev
   ```

6. **Prueba**: entra al panel → **Suscripción** en la barra lateral → *Probar 14
   días gratis*. En el formulario de Stripe usa la tarjeta de prueba:

   | Campo | Valor |
   |---|---|
   | Número | `4242 4242 4242 4242` |
   | Vencimiento | cualquier fecha futura (ej. `12/30`) |
   | CVC | cualquier 3 dígitos |
   | Código postal | cualquiera (ej. `01000`) |

   Al terminar deberías ver:
   - en la terminal de `stripe listen`, los eventos `checkout.session.completed`
     y `customer.subscription.created`;
   - en la app, el badge del encabezado y la página de suscripción en **Pro**,
     con la fecha de próxima renovación.

7. **Prueba la cancelación**: en la página de suscripción, botón **Gestionar** →
   se abre el Customer Portal de Stripe → cancelar. Deberías ver
   *"Tu plan termina el … y la cuenta vuelve a Free"*.

8. **Prueba un pago fallido** (opcional pero recomendable) con la tarjeta
   `4000 0000 0000 0341`: el estado debe quedar en *Pago pendiente* sin que
   pierdas el acceso.

9. **Vuelve a `BILLING_MODE=beta`** cuando termines de probar, si el piloto sigue
   en curso.

## Paso 7 — Producción (cuando decidas empezar a cobrar)

1. **Activa la cuenta de Stripe**: en el dashboard, completa *Activate account*
   con RFC, domicilio fiscal y cuenta bancaria (CLABE). Stripe tarda de unas
   horas a un par de días en aprobar.
2. **Cambia el dashboard a modo real** (apaga *Test mode*) y **vuelve a crear los
   tres precios del paso 2**: los productos de prueba no existen en modo real.
   Copia los nuevos `price_...`.
3. **Crea el endpoint de webhook real**: **Developers → Webhooks → Add endpoint**.
   - URL: `https://<tu-dominio>/api/webhooks/stripe`
   - Eventos a enviar (solo estos seis):
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
   - Copia el **Signing secret** (`whsec_...`) de ese endpoint.
4. **Configura las variables en Vercel** (Settings → Environment Variables), en
   el ambiente **Production**:

   ```
   BILLING_MODE=produccion
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...        (el del endpoint de producción)
   STRIPE_PRICE_PRO_MENSUAL=price_...     (los de modo real)
   STRIPE_PRICE_PRO_ANUAL=price_...
   STRIPE_PRICE_CLINICA_MENSUAL=price_...
   APP_URL=https://<tu-dominio>
   ```

   Para **Preview** deja `BILLING_MODE=beta` y las llaves de prueba: no quieres
   que un deploy de rama cobre a nadie.
5. **Redespliega** para que tome las variables nuevas.
6. **Personaliza la marca del checkout**: **Settings → Branding** (logo, color,
   nombre del negocio). Es lo que verá el nutriólogo al pagar.
7. **Configura el Customer Portal**: **Settings → Billing → Customer portal**.
   Activa cambio de plan, actualización de tarjeta y cancelación, y sube tus
   términos y aviso de privacidad.
8. **Alerta de webhooks fallidos**: en la página del endpoint, activa la
   notificación por correo. Un webhook caído significa gente que pagó y sigue
   viéndose en Free.

---

## Qué hace la app con cada cosa

| Variable | Para qué |
|---|---|
| `BILLING_MODE` | `beta` = todo gratis y sin límites. `produccion` = topes de Free y cobro activos. |
| `STRIPE_SECRET_KEY` | Crear sesiones de checkout y de portal. Sin ella, ambos responden 503. |
| `STRIPE_WEBHOOK_SECRET` | Verificar la firma del webhook. Sin ella, el webhook responde 503 y nada cambia de plan. |
| `STRIPE_PRICE_*` | Qué precio contratar. Un plan sin su price id aparece como "próximamente". |
| `APP_URL` | A dónde regresa Stripe tras el pago. |

## Cosas que conviene tener claras

- **El plan de un usuario solo lo cambia el webhook.** Ni el panel ni un endpoint
  del panel escriben el plan. Si quieres regalarle Pro a alguien, hazlo desde el
  dashboard de Stripe (crea una suscripción para su customer, o aplica un cupón
  del 100 %) y el webhook se encarga.
- **Los topes se aplican en el servidor**, no escondiendo botones. Un nutriólogo
  con la sesión en la mano y `curl` recibe el mismo 402.
- **Los límites de Free** cuando salgas de beta: 3 pacientes activos, 15
  generaciones de IA al mes, sin PDF con marca propia, 3 plantillas.
- **CFDI 4.0** (factura fiscal timbrada) no está: Stripe emite recibos. El
  timbrado con Facturapi quedó documentado como V2.1.
- **Los precios están en el código** (`packages/shared/src/suscripcion/planes.ts`)
  y en Stripe. Si cambias uno, cambia el otro: lo que se cobra es lo de Stripe;
  lo que se muestra en la página, lo del código.
