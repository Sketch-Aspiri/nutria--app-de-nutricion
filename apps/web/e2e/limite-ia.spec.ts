import { expect, test } from '@playwright/test';

import { mesDeUso } from '@nutria/shared';

import {
  type CuentaPrueba,
  borrarCuentas,
  crearNutriologo,
  crearPacienteEnBase,
  iniciarSesion,
  prisma,
} from './utils/cuentas';

/**
 * Flujo E2E #10: cuota de IA.
 *
 * Verifica que el límite se aplique en el servidor —no solo escondiendo un
 * botón—, que responda `AI_LIMIT_REACHED` con el CTA de mejora de plan, y que
 * el contador no siga subiendo una vez agotado.
 *
 * No llama a Anthropic: la cuota se agota sembrando `ai_usage`, así que el
 * rechazo ocurre antes de que el servicio contacte al proveedor. Todos los
 * datos son ficticios.
 */

const LIMITE_FREE = 15;

let nutriologa: CuentaPrueba | undefined;
let pacienteId = '';

async function fijarConsumo(userId: string, generaciones: number): Promise<void> {
  const mes = mesDeUso();
  await prisma.aiUsage.upsert({
    where: { userId_mes: { userId, mes } },
    create: { userId, mes, generaciones },
    update: { generaciones },
  });
}

async function consumoActual(userId: string): Promise<number> {
  const registro = await prisma.aiUsage.findUnique({
    where: { userId_mes: { userId, mes: mesDeUso() } },
    select: { generaciones: true },
  });
  return registro?.generaciones ?? 0;
}

test.beforeAll(async () => {
  nutriologa = await crearNutriologo('ia-limite', 'Nutrióloga Cuota IA E2E');
  const paciente = await crearPacienteEnBase(nutriologa.id, 'Paciente Cuota IA E2E');
  pacienteId = paciente.id;
});

test.afterAll(async () => {
  if (nutriologa) await borrarCuentas(nutriologa);
  await prisma.$disconnect();
});

test.describe('Flujo #10 — límite de generaciones de IA', () => {
  test('la cuota del plan Free se reporta y se agota en el servidor', async ({ page }) => {
    test.skip(!nutriologa, 'No se pudo preparar la cuenta de prueba.');
    const cuenta = nutriologa!;

    await fijarConsumo(cuenta.id, 0);
    await iniciarSesion(page, cuenta);

    // 1. Con cuota libre, el endpoint reporta el plan Free y su límite.
    const inicial = await page.request.get('/api/v1/ai/usage');
    expect(inicial.ok()).toBeTruthy();
    expect(await inicial.json()).toMatchObject({
      plan: 'FREE',
      limite: LIMITE_FREE,
      usadas: 0,
      restantes: LIMITE_FREE,
      agotada: false,
    });

    // 2. Agotada la cuota, el endpoint lo refleja.
    await fijarConsumo(cuenta.id, LIMITE_FREE);
    const agotada = await page.request.get('/api/v1/ai/usage');
    expect(await agotada.json()).toMatchObject({ restantes: 0, agotada: true });

    // 3. Generar responde 429 AI_LIMIT_REACHED con el CTA de mejora de plan.
    const rechazo = await page.request.post('/api/v1/ai/generate', {
      data: { tipo: 'PLAN', patient_id: pacienteId },
    });
    expect(rechazo.status()).toBe(429);
    const cuerpo = (await rechazo.json()) as { error: { code: string; message: string } };
    expect(cuerpo.error.code).toBe('AI_LIMIT_REACHED');
    expect(cuerpo.error.message).toContain('Mejora tu plan');

    // 4. El rechazo no consume cuota: el contador se queda en el límite.
    expect(await consumoActual(cuenta.id)).toBe(LIMITE_FREE);
  });

  test('el límite se aplica aunque el cliente pida streaming', async ({ page }) => {
    test.skip(!nutriologa, 'No se pudo preparar la cuenta de prueba.');
    const cuenta = nutriologa!;

    await fijarConsumo(cuenta.id, LIMITE_FREE);
    await iniciarSesion(page, cuenta);

    const respuesta = await page.request.post('/api/v1/ai/generate', {
      data: { tipo: 'PLAN', patient_id: pacienteId, stream: true },
    });

    // El stream responde 200 y el fallo viaja como evento SSE.
    expect(respuesta.status()).toBe(200);
    expect(await respuesta.text()).toContain('AI_LIMIT_REACHED');
  });

  test('un plan superior amplía el límite sin tocar el contador', async ({ page }) => {
    test.skip(!nutriologa, 'No se pudo preparar la cuenta de prueba.');
    const cuenta = nutriologa!;

    await fijarConsumo(cuenta.id, LIMITE_FREE);
    await prisma.subscription.update({
      where: { userId: cuenta.id },
      data: { plan: 'PRO', status: 'ACTIVE' },
    });
    await iniciarSesion(page, cuenta);

    const respuesta = await page.request.get('/api/v1/ai/usage');

    expect(await respuesta.json()).toMatchObject({
      plan: 'PRO',
      limite: 150,
      usadas: LIMITE_FREE,
      restantes: 135,
      agotada: false,
    });

    await prisma.subscription.update({
      where: { userId: cuenta.id },
      data: { plan: 'FREE' },
    });
  });

  test('la cuota de un nutriólogo no se ve afectada por la de otro', async ({ page }) => {
    test.skip(!nutriologa, 'No se pudo preparar la cuenta de prueba.');
    const otro = await crearNutriologo('ia-limite-b', 'Nutriólogo Cuota B E2E');

    try {
      await fijarConsumo(nutriologa!.id, LIMITE_FREE);
      await iniciarSesion(page, otro);

      const respuesta = await page.request.get('/api/v1/ai/usage');

      expect(await respuesta.json()).toMatchObject({ usadas: 0, agotada: false });
    } finally {
      await borrarCuentas(otro);
    }
  });

  test('sin sesión, el endpoint de cuota no revela nada', async ({ request }) => {
    const respuesta = await request.get('/api/v1/ai/usage');

    expect(respuesta.status()).toBe(401);
  });
});
