import { expect, test } from '@playwright/test';

import {
  type CuentaPrueba,
  borrarCuentas,
  crearNutriologo,
  crearPacienteEnBase,
  iniciarSesion,
  prisma,
} from './utils/cuentas';

/**
 * Flujo E2E #8: suscripción y paywall.
 *
 * Cubre lo que es nuestro: que el tope de un plan se aplique **en el
 * servidor**, que la UI ofrezca la salida, y que el estado que escribe el
 * webhook (plan Pro, cancelación al fin del periodo) cambie los entitlements de
 * inmediato.
 *
 * El plan Free ya no se asigna a ninguna cuenta nueva (toda cuenta nace en Pro,
 * ver Docs/plan-fin-plan-free-superadmin.md); el enum y su cálculo de
 * entitlements siguen vivos a propósito (limpieza pendiente), así que algunos
 * de estos tests siguen forzándolo por Prisma solo para ejercitar ese código,
 * no porque represente a un usuario real.
 *
 * Lo que no cubre, a propósito: la pasarela de Stripe. El checkout ocurre en un
 * dominio de Stripe y su resultado nos llega como webhook; ese salto se prueba
 * en local con `stripe listen` y tarjetas de prueba (ver la guía de
 * configuración), no automatizando la UI de un tercero. Aquí se escribe en
 * `subscriptions` exactamente lo que el webhook escribiría.
 *
 * El servidor de prueba corre con `BILLING_MODE=produccion` (playwright.config):
 * durante la beta comercial no hay tope que ejercitar.
 *
 * Todos los datos son ficticios.
 */

const CUPO_FREE = 3;

let nutriologa: CuentaPrueba | undefined;

async function fijarSuscripcion(
  userId: string,
  datos: {
    plan: 'FREE' | 'PRO' | 'CLINICA';
    status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE';
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: Date;
    stripeSubscriptionId?: string;
  },
): Promise<void> {
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      accessExpiresAt: datos.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ...datos,
    },
    update: { ...datos },
  });
}

/**
 * Deja la cuenta justo en el cupo del plan Free.
 *
 * Cada test lo llama por su cuenta: Playwright reinicia el worker tras un fallo
 * y vuelve a ejecutar `beforeAll`, así que un test que dependa del estado que
 * dejó el anterior pasa o falla según qué haya pasado antes.
 */
async function llenarCupoFree(userId: string): Promise<void> {
  const existentes = await prisma.patient.count({
    where: { nutritionistId: userId, estado: 'ACTIVO', deletedAt: null },
  });
  for (let i = existentes; i < CUPO_FREE; i += 1) {
    await crearPacienteEnBase(userId, `Paciente Cupo ${i + 1} E2E`);
  }
}

test.beforeAll(async () => {
  nutriologa = await crearNutriologo('suscripcion', 'Nutrióloga Suscripción E2E');
});

test.afterAll(async () => {
  if (nutriologa) await borrarCuentas(nutriologa);
  await prisma.$disconnect();
});

test.describe('Flujo #8 — suscripción, cupo del plan y paywall', () => {
  test('una cuenta Pro reporta su acceso y, sin Stripe configurado, ofrece el contacto de renovación', async ({
    page,
  }) => {
    test.skip(!nutriologa, 'No se pudo preparar la cuenta de prueba.');
    const cuenta = nutriologa!;

    // Cuenta recién creada: ya nace en Pro con acceso vigente (fin del plan
    // Free, ver Docs/plan-fin-plan-free-superadmin.md), sin tocar `subscription`.
    await iniciarSesion(page, cuenta);

    const respuesta = await page.request.get('/api/v1/billing/subscription');
    expect(respuesta.ok()).toBeTruthy();
    expect(await respuesta.json()).toMatchObject({
      plan: 'PRO',
      modo: 'produccion',
      pagos_habilitados: false,
      entitlements: {
        pacientes: { limite: null, alcanzado: false },
        ia: { limite: 150 },
        marca_blanca: true,
      },
    });

    await page.goto('/suscripcion');
    await expect(page.getByRole('heading', { name: 'Plan y acceso' })).toBeVisible();
    await expect(page.getByText('Generaciones de IA', { exact: true })).toBeVisible();
    // Sin `STRIPE_SECRET_KEY` configurada, la página no ofrece checkout: pide
    // contactar al equipo para renovar (ver `stripeConfigurado()` en config.ts).
    await expect(page.getByRole('heading', { name: 'Renovación mensual' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contactar para renovar' })).toBeVisible();
  });

  test('al tercer paciente el servidor rechaza el alta con 402 PLAN_LIMIT', async ({ page }) => {
    test.skip(!nutriologa, 'No se pudo preparar la cuenta de prueba.');
    const cuenta = nutriologa!;

    await fijarSuscripcion(cuenta.id, { plan: 'FREE', status: 'ACTIVE' });
    await llenarCupoFree(cuenta.id);
    await iniciarSesion(page, cuenta);

    const cupo = await page.request.get('/api/v1/billing/subscription');
    expect(await cupo.json()).toMatchObject({
      entitlements: { pacientes: { usados: CUPO_FREE, restantes: 0, alcanzado: true } },
    });

    // El tope se aplica en el handler, no escondiendo el botón: se llama la API
    // directamente, que es lo que haría cualquiera con la sesión en la mano.
    const rechazo = await page.request.post('/api/v1/patients', {
      data: {
        nombre: 'Paciente Excedente E2E',
        genero: 'FEMENINO',
        consentimiento_datos_sensibles: true,
        consentimiento_metodo: 'ESCRITO',
      },
    });
    expect(rechazo.status()).toBe(402);
    const cuerpo = (await rechazo.json()) as { error: { code: string; message: string } };
    expect(cuerpo.error.code).toBe('PLAN_LIMIT');
    expect(cuerpo.error.message).toContain('Mejora tu plan');
  });

  test('el asistente muestra el paywall con la salida a los planes', async ({ page }) => {
    test.skip(!nutriologa, 'No se pudo preparar la cuenta de prueba.');
    const cuenta = nutriologa!;

    await fijarSuscripcion(cuenta.id, { plan: 'FREE', status: 'ACTIVE' });
    await llenarCupoFree(cuenta.id);
    await iniciarSesion(page, cuenta);

    await page.goto('/pacientes');
    await page
      .getByRole('button', { name: /Nuevo paciente/i })
      .first()
      .click();
    await page
      .getByLabel(/Nombre/i)
      .first()
      .fill('Paciente Paywall E2E');
    for (let i = 0; i < 3; i += 1) {
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }
    await page.getByLabel(/Confirmo que entregué al paciente el aviso de privacidad/i).check();
    await page.getByRole('button', { name: 'Crear paciente' }).click();

    // Next.js monta su propio `role="alert"` para anunciar rutas; se filtra por
    // el texto del aviso en vez de asumir que solo hay uno en la página.
    const alerta = page.getByRole('alert').filter({ hasText: 'pacientes activos' });
    await expect(alerta).toBeVisible();
    await expect(alerta.getByRole('link', { name: 'Ver planes' })).toBeVisible();
  });

  test('el estado que escribe el webhook amplía y luego retira el acceso', async ({ page }) => {
    test.skip(!nutriologa, 'No se pudo preparar la cuenta de prueba.');
    const cuenta = nutriologa!;

    await llenarCupoFree(cuenta.id);

    // 1. Lo que dejaría `checkout.session.completed` tras un pago exitoso.
    const finDePeriodo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await fijarSuscripcion(cuenta.id, {
      plan: 'PRO',
      status: 'ACTIVE',
      currentPeriodEnd: finDePeriodo,
      stripeSubscriptionId: `sub_e2e_${cuenta.id.slice(0, 8)}`,
    });
    await iniciarSesion(page, cuenta);

    const conPro = await page.request.get('/api/v1/billing/subscription');
    expect(await conPro.json()).toMatchObject({
      plan: 'PRO',
      tiene_suscripcion_stripe: true,
      entitlements: {
        pacientes: { limite: null, alcanzado: false },
        ia: { limite: 150 },
        marca_blanca: true,
      },
    });

    // Con Pro, el alta que antes daba 402 pasa.
    const alta = await page.request.post('/api/v1/patients', {
      data: {
        nombre: 'Paciente Con Pro E2E',
        genero: 'FEMENINO',
        consentimiento_datos_sensibles: true,
        consentimiento_metodo: 'ESCRITO',
      },
    });
    expect(alta.status()).toBe(201);

    // 2. Cancelación programada: sigue con acceso hasta el fin del periodo.
    await fijarSuscripcion(cuenta.id, {
      plan: 'PRO',
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: finDePeriodo,
    });
    const cancelando = await page.request.get('/api/v1/billing/subscription');
    expect(await cancelando.json()).toMatchObject({
      plan: 'PRO',
      cancela_al_final: true,
      entitlements: { pacientes: { limite: null } },
    });

    // 3. `customer.subscription.deleted`: la cuenta vuelve a Free y al cupo.
    await fijarSuscripcion(cuenta.id, { plan: 'FREE', status: 'CANCELED' });
    const cancelada = await page.request.get('/api/v1/billing/subscription');
    expect(await cancelada.json()).toMatchObject({
      plan: 'FREE',
      estado: 'CANCELED',
      entitlements: { pacientes: { limite: CUPO_FREE, alcanzado: true }, marca_blanca: false },
    });
  });

  test('sin sesión, la suscripción no se consulta ni se contrata', async ({ request }) => {
    expect((await request.get('/api/v1/billing/subscription')).status()).toBe(401);
    expect(
      (await request.post('/api/v1/billing/checkout', { data: { plan: 'PRO' } })).status(),
    ).toBe(401);
    expect((await request.post('/api/v1/billing/portal')).status()).toBe(401);
  });

  test('el webhook rechaza cualquier evento sin firma válida de Stripe', async ({ request }) => {
    const sinFirma = await request.post('/api/webhooks/stripe', {
      data: { id: 'evt_falso', type: 'customer.subscription.updated' },
    });
    // 400 sin firma; 503 si el servidor de prueba no tiene el secreto. Lo que
    // no puede pasar nunca es un 200: un evento inventado no cambia un plan.
    expect([400, 503]).toContain(sinFirma.status());

    const firmaInventada = await request.post('/api/webhooks/stripe', {
      headers: { 'stripe-signature': 't=1,v1=falsa' },
      data: { id: 'evt_falso', type: 'customer.subscription.updated' },
    });
    expect([400, 503]).toContain(firmaInventada.status());
  });
});
