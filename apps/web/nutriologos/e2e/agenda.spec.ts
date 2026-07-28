import { expect, test } from '@playwright/test';

import {
  borrarCuentas,
  crearNutriologo,
  type CuentaPrueba,
  iniciarSesion,
  prisma,
} from './utils/cuentas';
import { leerBuzon, limpiarBuzon } from './utils/correo';

/**
 * Flujo E2E #6: agenda sobre PostgreSQL.
 *
 * Crear una cita desde el panel, verla en la lista, recibir el recordatorio
 * por correo a través del cron y cancelarla. Se comprueba además lo que la UI
 * no puede garantizar por sí sola: el empalme de horarios, la idempotencia del
 * recordatorio y el aislamiento entre nutriólogos.
 *
 * Todos los datos son ficticios; la cuenta se crea y se borra en el test.
 */

const CRON = '/api/v1/cron/appointment_reminders';
const EMAIL_PACIENTE = 'paciente-agenda-e2e@nutria.test';

let nutriologa: CuentaPrueba | undefined;
let otroNutriologo: CuentaPrueba | undefined;
let pacienteId = '';
let citaConRecordatorioId = '';

function pad(valor: number): string {
  return `${valor}`.padStart(2, '0');
}

/**
 * Fecha en la zona del navegador, que es la que el formulario interpreta.
 * El test y el navegador corren en la misma máquina, así que coinciden.
 */
function fechaLocal(diasDesdeHoy: number): string {
  const dia = new Date();
  dia.setDate(dia.getDate() + diasDesdeHoy);
  return `${dia.getFullYear()}-${pad(dia.getMonth() + 1)}-${pad(dia.getDate())}`;
}

function autorizacionCron(): Record<string, string> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) throw new Error('CRON_SECRET no está definida; la fija playwright.config.ts.');
  return { Authorization: `Bearer ${secreto}` };
}

test.beforeAll(async () => {
  await limpiarBuzon();

  nutriologa = await crearNutriologo('agenda-a', 'Nutrióloga Agenda E2E');
  otroNutriologo = await crearNutriologo('agenda-b', 'Nutriólogo Ajeno E2E');

  await prisma.nutritionistProfile.update({
    where: { userId: nutriologa.id },
    data: { marcaNombre: 'Consulta Agenda E2E', zonaHoraria: 'America/Mexico_City' },
  });

  const paciente = await prisma.patient.create({
    data: {
      nutritionistId: nutriologa.id,
      nombre: 'Paciente Agenda E2E',
      genero: 'FEMENINO',
      email: EMAIL_PACIENTE,
      medicalRecord: { create: { objetivo: 'PERDIDA_DE_GRASA' } },
      foodPreference: { create: {} },
    },
    select: { id: true },
  });
  pacienteId = paciente.id;

  // Cita dentro de la ventana de aviso (24 h) para ejercitar el cron. La que
  // se crea desde la UI se agenda a tres días para que no entre en la ventana
  // y el conteo de correos siga siendo determinista a cualquier hora del día.
  const enDosHoras = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const cita = await prisma.appointment.create({
    data: {
      nutritionistId: nutriologa.id,
      patientId: pacienteId,
      inicio: enDosHoras,
      duracionMin: 45,
      tipo: 'PRESENCIAL',
      notas: 'Consulta de control (ficticia).',
    },
    select: { id: true },
  });
  citaConRecordatorioId = cita.id;
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

test('agenda una cita, la ve en la lista, recibe el recordatorio y la cancela', async ({
  context,
  page,
}) => {
  if (!nutriologa || !otroNutriologo || !pacienteId || !citaConRecordatorioId) {
    throw new Error('No se pudo preparar el fixture aislado del E2E de agenda.');
  }

  await iniciarSesion(page, nutriologa);
  await page.goto('/agenda');

  // La cita sembrada llega desde la BD, no desde el estado del navegador.
  const filas = page.getByTestId('fila-cita');
  await expect(filas).toHaveCount(1);
  await expect(filas.first()).toContainText('Paciente Agenda E2E');
  await expect(page.getByText('1 citas programadas')).toBeVisible();

  // --- Alta desde el panel ---------------------------------------------------
  const fechaNueva = fechaLocal(3);
  await page.getByRole('button', { name: 'Nueva cita' }).click();
  // `exact` en todo el formulario: los botones de cada fila llevan el nombre
  // del paciente en su `aria-label` y colisionarían con la coincidencia parcial.
  await page.getByLabel('Paciente', { exact: true }).selectOption(pacienteId);
  await page.getByLabel('Fecha', { exact: true }).fill(fechaNueva);
  await page.getByLabel('Hora', { exact: true }).fill('10:00');
  await page.getByLabel('Duración', { exact: true }).selectOption('60');
  await page.getByLabel('Tipo', { exact: true }).selectOption('VIDEOLLAMADA');
  await page.getByLabel('Enlace de la sala').fill('https://meet.google.com/e2e-agenda');
  await page.getByLabel('Notas (opcional)').fill('Revisión de plan (ficticia).');
  await page.getByRole('button', { name: 'Agendar' }).click();

  await expect(filas).toHaveCount(2);
  await expect(page.getByText('2 citas programadas')).toBeVisible();

  const citaNueva = await prisma.appointment.findFirstOrThrow({
    where: { nutritionistId: nutriologa.id, tipo: 'VIDEOLLAMADA' },
  });
  expect(citaNueva).toMatchObject({
    patientId: pacienteId,
    duracionMin: 60,
    estado: 'PROGRAMADA',
    videoUrl: 'https://meet.google.com/e2e-agenda',
    recordatorioEnviadoAt: null,
  });
  // La hora capturada en el formulario se guardó como el instante correcto.
  expect(citaNueva.inicio.getTime()).toBe(new Date(`${fechaNueva}T10:00`).getTime());

  // El horario ocupado se defiende en el servidor, no solo en el formulario.
  const empalmada = await page.request.post('/api/v1/appointments', {
    data: {
      patient_id: pacienteId,
      inicio: new Date(`${fechaNueva}T10:30`).toISOString(),
      duracion_min: 30,
    },
  });
  expect(empalmada.status()).toBe(409);
  expect(await empalmada.json()).toMatchObject({
    error: { code: 'APPOINTMENT_CONFLICT' },
  });

  // --- Recordatorio por cron -------------------------------------------------
  const sinSecreto = await page.request.get(CRON);
  expect(sinSecreto.status()).toBe(401);
  expect(await leerBuzon(EMAIL_PACIENTE)).toHaveLength(0);

  const conSecreto = await page.request.get(CRON, { headers: autorizacionCron() });
  expect(conSecreto.status()).toBe(200);
  expect(await conSecreto.json()).toMatchObject({ enviados: 1, fallidos: 0, sinCorreo: 0 });

  const correos = await leerBuzon(EMAIL_PACIENTE);
  expect(correos).toHaveLength(1);
  const recordatorio = correos[0]!;
  expect(recordatorio.asunto).toContain('Recordatorio');
  expect(recordatorio.html).toContain('Paciente Agenda E2E');
  expect(recordatorio.html).toContain('Consulta Agenda E2E');
  // El recordatorio no lleva datos clínicos: un buzón compartido o reenviado
  // no debe revelar objetivo, peso ni las notas de la consulta.
  expect(recordatorio.html).not.toContain('Consulta de control');
  expect(recordatorio.html.toLowerCase()).not.toContain('grasa');

  // Idempotencia: la corrida siguiente no vuelve a escribirle al paciente.
  const repetida = await page.request.get(CRON, { headers: autorizacionCron() });
  expect(repetida.status()).toBe(200);
  expect(await repetida.json()).toMatchObject({ candidatas: 0, enviados: 0 });
  expect(await leerBuzon(EMAIL_PACIENTE)).toHaveLength(1);

  // La cita a tres días queda fuera de la ventana: no se avisa antes de tiempo.
  expect(
    (await prisma.appointment.findUniqueOrThrow({ where: { id: citaNueva.id } }))
      .recordatorioEnviadoAt,
  ).toBeNull();

  await page.reload();
  await expect(
    page.getByTestId('fila-cita').filter({ hasText: 'Presencial' }),
  ).toContainText('Recordado');

  // --- Cancelación -----------------------------------------------------------
  const filaVideollamada = page.getByTestId('fila-cita').filter({ hasText: 'Videollamada' });
  await filaVideollamada
    .getByRole('button', { name: 'Cancelar cita de Paciente Agenda E2E' })
    .click();
  await expect(filaVideollamada.getByTestId('estado-cita')).toHaveText('Cancelada');
  await expect(page.getByText('1 citas programadas')).toBeVisible();

  await expect
    .poll(
      async () =>
        (await prisma.appointment.findUniqueOrThrow({ where: { id: citaNueva.id } })).estado,
    )
    .toBe('CANCELADA');

  // Una cita cerrada no se vuelve a cerrar: es el registro de lo que pasó.
  const recierre = await page.request.post(`/api/v1/appointments/${citaNueva.id}/cancel`);
  expect(recierre.status()).toBe(409);
  expect(await recierre.json()).toMatchObject({
    error: { code: 'APPOINTMENT_NOT_EDITABLE' },
  });

  // --- Aislamiento entre nutriólogos ----------------------------------------
  await context.clearCookies();
  await iniciarSesion(page, otroNutriologo);
  await page.goto('/agenda');
  await expect(page.getByTestId('fila-cita')).toHaveCount(0);

  // Mismo UUID, otra cuenta: 404 y no 403, para no revelar que la cita existe.
  const ajena = await page.request.get(`/api/v1/appointments/${citaConRecordatorioId}`);
  expect(ajena.status()).toBe(404);
  expect(await ajena.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });

  const cierreAjeno = await page.request.post(
    `/api/v1/appointments/${citaConRecordatorioId}/complete`,
  );
  expect(cierreAjeno.status()).toBe(404);
  expect(
    (await prisma.appointment.findUniqueOrThrow({ where: { id: citaConRecordatorioId } }))
      .estado,
  ).toBe('PROGRAMADA');
});
