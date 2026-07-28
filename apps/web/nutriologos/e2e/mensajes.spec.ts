import { expect, test } from '@playwright/test';

import {
  borrarCuentas,
  crearNutriologo,
  type CuentaPrueba,
  iniciarSesion,
  prisma,
} from './utils/cuentas';

/**
 * Flujo E2E #7: mensajería con sondeo.
 *
 * La bandeja marca pendientes, el nutriólogo responde, el mensaje queda en la
 * base (una segunda sesión lo lee del servidor, no del navegador que lo
 * escribió), lo que llega del paciente aparece por sondeo sin recargar, y la
 * IA solo propone un borrador editable.
 *
 * Todos los datos son ficticios; la cuenta se crea y se borra en el test.
 */

/** El hilo abierto se sondea cada 15 s (`useMensajes`). */
const MS_ESPERA_SONDEO = 40_000;

// Esperar al sondeo no cabe en el minuto que da la configuración por defecto.
test.setTimeout(150_000);

let nutriologa: CuentaPrueba | undefined;
let otroNutriologo: CuentaPrueba | undefined;
let pacienteId = '';

test.beforeAll(async () => {
  nutriologa = await crearNutriologo('msg-a', 'Nutrióloga Mensajes E2E');
  otroNutriologo = await crearNutriologo('msg-b', 'Nutriólogo Ajeno E2E');

  const paciente = await prisma.patient.create({
    data: {
      nutritionistId: nutriologa.id,
      nombre: 'Paciente Mensajes E2E',
      genero: 'MASCULINO',
      email: 'paciente-mensajes-e2e@nutria.test',
      telefono: '5500000000',
      medicalRecord: { create: { objetivo: 'PERDIDA_DE_GRASA' } },
      foodPreference: { create: {} },
    },
    select: { id: true },
  });
  pacienteId = paciente.id;

  // Lo que el paciente mandó desde la app móvil, todavía sin leer.
  await prisma.message.createMany({
    data: [
      {
        nutritionistId: nutriologa.id,
        patientId: pacienteId,
        emisor: 'PATIENT',
        texto: 'Hola, ¿puedo cambiar la colación de la tarde?',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        nutritionistId: nutriologa.id,
        patientId: pacienteId,
        emisor: 'PATIENT',
        texto: 'Me quedé sin avena esta semana.',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    ],
  });
});

test.afterAll(async () => {
  try {
    const cuentas = [nutriologa, otroNutriologo].filter(
      (cuenta): cuenta is CuentaPrueba => Boolean(cuenta),
    );
    if (cuentas.length > 0) await borrarCuentas(...cuentas);
  } finally {
    await prisma.$disconnect();
  }
});

test('lee el hilo pendiente, responde con ayuda de IA y recibe lo nuevo por sondeo', async ({
  browser,
  context,
  page,
}) => {
  if (!nutriologa || !otroNutriologo || !pacienteId) {
    throw new Error('No se pudo preparar el fixture aislado del E2E de mensajes.');
  }

  await iniciarSesion(page, nutriologa);
  await page.goto('/mensajes');

  // --- Bandeja ---------------------------------------------------------------
  const conversacion = page.getByRole('button', { name: /Paciente Mensajes E2E/ });
  await expect(conversacion).toBeVisible();
  await expect(page.getByLabel('2 mensajes sin leer')).toBeVisible();
  await expect(conversacion).toContainText('Me quedé sin avena esta semana.');

  await conversacion.click();
  await expect(page.getByText('¿puedo cambiar la colación de la tarde?')).toBeVisible();
  // El texto también vive en el resumen de la bandeja, de ahí el `first()`.
  await expect(page.getByText('Me quedé sin avena esta semana.').first()).toBeVisible();

  // Abrir el hilo acusa recibo: el contador no puede quedarse encendido.
  await expect(page.getByLabel('2 mensajes sin leer')).toHaveCount(0);
  await expect
    .poll(() =>
      prisma.message.count({
        where: { patientId: pacienteId, emisor: 'PATIENT', leidoAt: null },
      }),
    )
    .toBe(0);

  // --- Sugerencia de IA ------------------------------------------------------
  const SUGERENCIA =
    'Podemos cambiar la colación por fruta con yogur mientras consigues la avena.';
  await page.route('**/api/v1/ai/generate', async (route) => {
    const cuerpo = route.request().postDataJSON() as { tipo: string; patient_id: string };
    // La UI manda intención, no el prompt: el nombre y el contacto del paciente
    // no salen del servidor (regla de `rules/ai-guidelines.md`).
    expect(cuerpo.tipo).toBe('RESPUESTA_MENSAJE');
    expect(JSON.stringify(cuerpo)).not.toContain('Paciente Mensajes E2E');
    expect(JSON.stringify(cuerpo)).not.toContain('paciente-mensajes-e2e@nutria.test');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tipo: 'RESPUESTA_MENSAJE',
        formato: 'texto',
        datos: null,
        texto: SUGERENCIA,
        advertencias: [],
        cuota: { usadas: 1, limite: 15, restantes: 14 },
      }),
    });
  });

  await page.getByRole('button', { name: 'Sugerir respuesta con IA' }).click();
  const campo = page.getByLabel('Mensaje');
  await expect(campo).toHaveValue(SUGERENCIA);
  await expect(page.getByText('revísalo antes de enviarlo')).toBeVisible();

  // El borrador de la IA no se envía solo: hasta aquí no hay nada guardado.
  expect(
    await prisma.message.count({ where: { patientId: pacienteId, emisor: 'NUTRITIONIST' } }),
  ).toBe(0);

  // --- Envío -----------------------------------------------------------------
  const RESPUESTA = `${SUGERENCIA} Avísame cómo te va.`;
  await campo.fill(RESPUESTA);
  await page.getByRole('button', { name: 'Enviar' }).click();

  await expect(campo).toHaveValue('');
  await expect(page.getByText(RESPUESTA).first()).toBeVisible();

  const enviado = await prisma.message.findFirstOrThrow({
    where: { patientId: pacienteId, emisor: 'NUTRITIONIST' },
  });
  expect(enviado).toMatchObject({
    nutritionistId: nutriologa.id,
    texto: RESPUESTA,
  });
  // Lo que uno mismo escribe nace leído.
  expect(enviado.leidoAt).not.toBeNull();

  // El emisor lo fija el servidor: no se puede escribir en nombre del paciente.
  const suplantacion = await page.request.post(`/api/v1/patients/${pacienteId}/messages`, {
    data: { texto: 'Mensaje que aparenta venir del paciente.', emisor: 'PATIENT' },
  });
  expect(suplantacion.status()).toBe(201);
  const mensajeCreado = (await suplantacion.json()) as { emisor: string };
  expect(mensajeCreado.emisor).toBe('NUTRITIONIST');

  // --- Segunda sesión: el hilo vive en el servidor ---------------------------
  const otraSesion = await browser.newContext();
  const otraPagina = await otraSesion.newPage();
  await iniciarSesion(otraPagina, nutriologa);
  await otraPagina.goto('/mensajes');
  await otraPagina.getByRole('button', { name: /Paciente Mensajes E2E/ }).click();
  await expect(otraPagina.getByText(RESPUESTA).first()).toBeVisible();
  await otraSesion.close();

  // --- Sondeo ----------------------------------------------------------------
  const NUEVO_DEL_PACIENTE = 'Perfecto, lo intento hoy mismo.';
  await prisma.message.create({
    data: {
      nutritionistId: nutriologa.id,
      patientId: pacienteId,
      emisor: 'PATIENT',
      texto: NUEVO_DEL_PACIENTE,
    },
  });
  // Sin recargar: el hilo abierto lo trae el sondeo de 15 s.
  await expect(page.getByText(NUEVO_DEL_PACIENTE).first()).toBeVisible({
    timeout: MS_ESPERA_SONDEO,
  });

  // --- Aislamiento entre nutriólogos ----------------------------------------
  await context.clearCookies();
  await iniciarSesion(page, otroNutriologo);
  await page.goto('/mensajes');
  await expect(page.getByText('Elige una conversación para empezar.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Paciente Mensajes E2E/ })).toHaveCount(0);

  // Mismo UUID, otra cuenta: 404 y no 403, para no revelar que el hilo existe.
  const ajeno = await page.request.get(`/api/v1/patients/${pacienteId}/messages`);
  expect(ajeno.status()).toBe(404);
  expect(await ajeno.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });

  const escrituraAjena = await page.request.post(`/api/v1/patients/${pacienteId}/messages`, {
    data: { texto: 'Mensaje de un nutriólogo que no lo atiende.' },
  });
  expect(escrituraAjena.status()).toBe(404);
  expect(await prisma.message.count({ where: { nutritionistId: otroNutriologo.id } })).toBe(0);
});
