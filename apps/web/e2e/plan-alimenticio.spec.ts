import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import {
  type CuentaPrueba,
  borrarCuentas,
  crearNutriologo,
  iniciarSesion,
  prisma,
} from './utils/cuentas';

/**
 * Flujo E2E #4: editor de plan sobre PostgreSQL, alimento ligado al catálogo,
 * activación, PDF real con marca blanca y entrega al paciente.
 *
 * Todos los nombres y datos son ficticios. El test crea y elimina su propia
 * cuenta para no reutilizar información clínica.
 */

const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

let nutriologa: CuentaPrueba | undefined;
let otroNutriologo: CuentaPrueba | undefined;
let pacienteId = '';
let alimentoId = '';
let alimentoNombre = '';

test.beforeAll(async () => {
  nutriologa = await crearNutriologo('plan-a', 'Nutrióloga Plan E2E');
  otroNutriologo = await crearNutriologo('plan-b', 'Nutriólogo Ajeno E2E');

  await prisma.nutritionistProfile.update({
    where: { userId: nutriologa.id },
    data: {
      nombreCompleto: 'Lic. Nutrición Plan E2E',
      cedulaProfesional: '00000000',
      especialidad: 'Nutrición clínica',
      marcaNombre: 'Consulta Plan E2E',
      marcaColor: '#0f766e',
      marcaLogoUrl: LOGO_PNG,
    },
  });

  // El PDF con marca propia es característica de pago (fase 7): en Free el
  // documento sale con la identidad de nutria. Este flujo prueba el plan y su
  // exportación, no el paywall, así que la cuenta va en Pro. El entitlement en
  // sí se cubre en `suscripcion.spec.ts`.
  await prisma.subscription.update({
    where: { userId: nutriologa.id },
    data: { plan: 'PRO', status: 'ACTIVE' },
  });

  const sufijo = Date.now().toString(36);
  alimentoNombre = `Avena clínica E2E ${sufijo}`;
  const alimento = await prisma.food.create({
    data: {
      nombre: alimentoNombre,
      nombreNormalizado: alimentoNombre.toLowerCase(),
      grupoSmae: 'cereales',
      porcionDescripcion: '1/2 taza',
      porcionGramos: 40,
      energiaKcal: 150,
      proteinaG: 5,
      lipidosG: 3,
      carbohidratosG: 25,
      equivalentes: { cereales: 2 },
      imagenUrl: LOGO_PNG,
      fuente: 'PROPIA',
      esPublico: false,
      nutritionistId: nutriologa.id,
    },
    select: { id: true },
  });
  alimentoId = alimento.id;

  const paciente = await prisma.patient.create({
    data: {
      nutritionistId: nutriologa.id,
      nombre: 'Paciente Plan E2E',
      genero: 'FEMENINO',
      email: 'paciente-plan-e2e@nutria.test',
      telefono: '5500000000',
      medicalRecord: { create: { objetivo: 'MANTENIMIENTO' } },
      foodPreference: { create: { comidasPorDia: 1, alergias: ['Cacahuate'] } },
    },
    select: { id: true },
  });
  pacienteId = paciente.id;
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

test('persiste un plan con food real, lo activa, descarga como PDF y lo comparte', async ({
  context,
  page,
}) => {
  if (!nutriologa || !otroNutriologo || !pacienteId || !alimentoId || !alimentoNombre) {
    throw new Error('No se pudo preparar el fixture aislado del E2E de planes.');
  }

  await iniciarSesion(page, nutriologa);
  await page.goto(`/pacientes/${pacienteId}`);
  await page.getByRole('button', { name: 'Plan alimenticio' }).click();

  /**
   * El borrador ya llega resuelto por el servidor: `food_id` contra el
   * catálogo y nutrimentos calculados. La generación va con streaming, así que
   * la respuesta simulada es SSE y el resultado viaja en el evento `final`.
   */
  const BORRADOR_IA = {
    calorias_diarias: 1800,
    proteina_g: 120,
    carbos_g: 205,
    grasa_g: 60,
    nota: 'Borrador ficticio generado para revisión profesional.',
    comidas: [
      {
        orden: 1,
        nombre: 'Desayuno de prueba',
        horario: '08:00',
        // El alérgeno vive en el item, no en la descripción de la comida: el
        // test lo corrige editando ese campo y la alerta debe desaparecer.
        descripcion: 'Propuesta ficticia para revisión profesional.',
        items: [
          {
            food_id: null,
            descripcion_libre: 'Preparación ficticia con cacahuate · 1 porción',
            cantidad_porciones: 1,
            energia_kcal: 1800,
            proteina_g: 120,
            carbohidratos_g: 205,
            lipidos_g: 60,
            food: null,
          },
        ],
      },
    ],
    totales: {
      energia_kcal: 1800,
      proteina_g: 120,
      carbohidratos_g: 205,
      lipidos_g: 60,
    },
  };

  await page.route('**/api/v1/ai/generate', async (route) => {
    const peticion = route.request().postDataJSON() as {
      tipo: string;
      patient_id: string;
    };
    // La UI manda intención —tipo y paciente—, nunca el prompt: armarlo y
    // seudonimizarlo es responsabilidad del servidor.
    expect(peticion.tipo).toBe('PLAN');
    expect(peticion.patient_id).toBe(pacienteId);
    const enviado = JSON.stringify(peticion);
    expect(enviado).not.toContain('Paciente Plan E2E');
    expect(enviado).not.toContain('paciente-plan-e2e@nutria.test');
    expect(enviado).not.toContain('5500000000');

    const final = {
      tipo: 'PLAN',
      formato: 'estructurado',
      datos: BORRADOR_IA,
      texto: null,
      advertencias: [],
      cuota: { usadas: 1, limite: 15, restantes: 14, agotada: false },
    };

    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body:
        `event: progreso\ndata: ${JSON.stringify({ tipo: 'progreso', caracteres: 320 })}\n\n` +
        `event: final\ndata: ${JSON.stringify(final)}\n\n`,
    });
  });

  await page.getByTestId('generate-ai-plan').getByRole('button').click();
  await expect(page.getByLabel('Meta de Energía')).toHaveValue('1800');
  await expect(page.getByLabel('Meta de Proteína')).toHaveValue('120');
  await expect(page.getByLabel('Meta de Carbohidratos')).toHaveValue('205');
  await expect(page.getByLabel('Meta de Grasas')).toHaveValue('60');
  // 1800 kcal reales frente a 1800 de meta: desviación 0 %, dentro del ±5 %.
  await expect(page.getByText('1800', { exact: true })).toBeVisible();
  await expect(page.getByText(/Revisa los alimentos marcados/)).toBeVisible();
  await expect(
    page.getByTestId('activate-plan').getByRole('button'),
  ).toBeDisabled();
  await page.getByLabel('Nombre de la comida 1').fill('Desayuno de prueba');
  await page.getByLabel('Horario de Desayuno de prueba').fill('08:00');

  await page.getByRole('button', { name: 'Buscar alimento' }).click();
  await page.getByLabel('Buscar alimento').fill(alimentoNombre);
  const resultadoAlimento = page.getByRole('listitem').filter({ hasText: alimentoNombre });
  await expect(resultadoAlimento.getByText(alimentoNombre, { exact: true })).toBeVisible();
  await expect(resultadoAlimento.locator('img')).toBeVisible();
  await resultadoAlimento.getByRole('button', { name: `Agregar ${alimentoNombre}` }).click();

  const itemAlimento = page.getByRole('listitem').filter({ hasText: alimentoNombre });
  const porciones = itemAlimento.getByRole('spinbutton', { name: 'Porciones' });
  // 0.25 porción agrega 37.5 kcal: total 1837.5, desviación 2.1 % frente a 1800.
  await porciones.fill('0.25');
  await expect(page.getByText('1837.5', { exact: true })).toBeVisible();
  await page
    .getByLabel('Indicaciones generales para el paciente')
    .fill('Tomar agua simple durante el día.');

  const guardar = page.getByTestId('save-plan').getByRole('button');
  await expect(guardar).toBeEnabled();
  await guardar.click();
  await expect(page.getByText('Todos los cambios guardados')).toBeVisible();

  await expect
    .poll(
      () =>
        prisma.mealPlan.findFirst({
          where: { patientId: pacienteId },
          include: { meals: { include: { items: true } } },
        }),
      { message: 'el plan debe persistirse en PostgreSQL' },
    )
    .not.toBeNull();

  const borradorConAlergeno = await prisma.mealPlan.findFirstOrThrow({
    where: { patientId: pacienteId },
    include: { meals: { include: { items: true } } },
  });
  await expect(
    page.getByTestId('activate-plan').getByRole('button'),
  ).toBeDisabled();

  // La UI bloquea la acción y el backend repite la misma regla de seguridad.
  const activacionBloqueada = await page.request.post(
    `/api/v1/meal_plans/${borradorConAlergeno.id}/activate`,
  );
  expect(activacionBloqueada.status()).toBe(422);
  expect(await activacionBloqueada.json()).toMatchObject({
    error: { code: 'PLAN_ALLERGEN_CONFLICT' },
  });

  await page
    .getByLabel(/^Descripción del alimento libre en /)
    .fill('Preparación ficticia revisada · 1 porción');
  await expect(page.getByText(/Revisa los alimentos marcados/)).toHaveCount(0);
  await guardar.click();
  await expect(page.getByText('Todos los cambios guardados')).toBeVisible();

  // El item conserva el FK a foods y el snapshot escalado de la porción.
  const enBase = await prisma.mealPlan.findFirstOrThrow({
    where: { patientId: pacienteId },
    include: { meals: { include: { items: true } } },
  });
  expect(enBase.meals).toHaveLength(1);
  expect(enBase.meals[0]?.items).toHaveLength(2);
  const itemLigado = enBase.meals[0]?.items.find((item) => item.foodId === alimentoId);
  expect(itemLigado).toMatchObject({
    foodId: alimentoId,
    cantidadPorciones: 0.25,
    energiaKcal: 37.5,
    proteinaG: 1.25,
    carbohidratosG: 6.25,
    lipidosG: 0.75,
  });
  const planId = enBase.id;

  // La recarga vuelve a leer el plan y sus items desde la API, no desde estado local.
  await page.reload();
  await page.getByRole('button', { name: 'Plan alimenticio' }).click();
  await expect(page.getByText(alimentoNombre, { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: alimentoNombre })
      .getByRole('spinbutton', { name: 'Porciones' }),
  ).toHaveValue('0.25');
  await expect(page.getByLabel('Indicaciones generales para el paciente')).toHaveValue(
    'Tomar agua simple durante el día.',
  );

  const activar = page.getByTestId('activate-plan').getByRole('button');
  await expect(activar).toBeEnabled();
  await activar.click();
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await prisma.mealPlan.findUnique({ where: { id: planId } }))?.estado)
    .toBe('ACTIVO');

  // El endpoint inline alimenta la vista previa y entrega bytes PDF, no HTML.
  const inline = await page.request.get(`/api/v1/meal_plans/${planId}/pdf`);
  expect(inline.status()).toBe(200);
  expect(inline.headers()['content-type']).toContain('application/pdf');
  expect(inline.headers()['content-disposition']).toMatch(/^inline;/);
  const pdfInline = await inline.body();
  expect(pdfInline.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  const fuentePdf = pdfInline.toString('latin1');
  expect(fuentePdf).toContain('Consulta Plan E2E');
  expect(fuentePdf).toMatch(/\/Subtype\s*\/Image\b/);

  const exportacionV2 = await page.request.post(
    `/api/v1/meal_plans/${planId}/export_pdf`,
  );
  expect(exportacionV2.status()).toBe(200);
  expect(exportacionV2.headers()['content-disposition']).toMatch(/^attachment;/);
  expect((await exportacionV2.body()).subarray(0, 5).toString('ascii')).toBe('%PDF-');

  await page.getByTestId('export-plan-pdf').getByRole('button').click();
  await expect(page.getByTitle('Vista previa del plan alimenticio')).toHaveAttribute(
    'src',
    `/api/v1/meal_plans/${planId}/pdf`,
  );

  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByLabel('Descargar PDF del plan').click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/^plan-alimenticio-.*\.pdf$/);
  const rutaDescarga = await descarga.path();
  expect(rutaDescarga).not.toBeNull();
  const archivo = await readFile(rutaDescarga!);
  expect(archivo.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  expect(archivo.byteLength).toBeGreaterThan(5_000);

  await page.getByLabel('Cerrar vista previa del PDF').click();
  const compartir = page.getByTestId('share-plan').getByRole('button');
  await expect(compartir).toBeEnabled();
  await compartir.click();
  await expect(page.getByRole('button', { name: 'Volver a compartir' })).toBeVisible();
  await expect
    .poll(
      async () =>
        Boolean(
          (await prisma.mealPlan.findUnique({ where: { id: planId } }))?.compartidoAt,
        ),
    )
    .toBe(true);

  // Mismo UUID, otra cuenta: 404 y no 403 para no revelar que el plan existe.
  await context.clearCookies();
  await iniciarSesion(page, otroNutriologo);
  const ajeno = await page.request.get(`/api/v1/meal_plans/${planId}/pdf`);
  expect(ajeno.status()).toBe(404);
  expect(await ajeno.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
});
