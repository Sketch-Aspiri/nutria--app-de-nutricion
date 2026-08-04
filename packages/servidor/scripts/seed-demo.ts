/**
 * Cuentas demo para recorrer las dos apps sin pasar por el correo.
 *
 * Crea un nutriólogo con tres pacientes y, de esos, uno con cuenta en la app del
 * paciente, plan activo y mediciones. Todo con datos **ficticios**: el proyecto
 * maneja datos de salud y nunca se siembran datos reales de personas.
 *
 * Es idempotente: vuelve a correrlo y las cuentas quedan en el mismo estado, con
 * la contraseña restablecida. Los pacientes demo se borran y se recrean para que
 * no se acumulen entre corridas.
 *
 * Uso (desde apps/web/nutriologos, que es donde vive el `.env`):
 *   npm run db:seed:demo
 *   DEMO_PASSWORD="otra-contrasena-larga" npm run db:seed:demo
 *
 * No corre contra una base cuya URL parezca de producción salvo que se pase
 * `--force`: una cuenta con contraseña conocida y documentada no debe existir
 * donde hay expedientes reales.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

import { calcularExpiracionInicial } from '@nutria/shared';

const prisma = new PrismaClient();

const PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-nutria-2026';
const EMAIL_NUTRIOLOGO = 'demo.nutriologo@nutria.mx';
const EMAIL_PACIENTE = 'demo.paciente@nutria.mx';
const VERSION_AVISO = 'demo';

/** Marca en el nombre para que nadie confunda estos registros con datos reales. */
const ETIQUETA = '[DEMO]';

function hace(dias: number): Date {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
}

/** Fecha sin hora, como espera una columna `@db.Date`. */
function soloFecha(dias: number): Date {
  const d = hace(dias);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function pareceProduccion(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  const esDesechable = /localhost|127\.0\.0\.1|test|preview|branch|staging|dev/i.test(url);
  return url.length > 0 && !esDesechable;
}

async function main(): Promise<void> {
  const forzar = process.argv.includes('--force');
  if (pareceProduccion() && !forzar) {
    console.error(
      'La DATABASE_URL no parece de una base desechable. Si de verdad quieres\n' +
        'sembrar cuentas demo ahí, vuelve a correr con --force.',
    );
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hash(PASSWORD, 12);
  const ahora = new Date();
  const accessExpiresAt = calcularExpiracionInicial(ahora);

  // --- Nutriólogo ---------------------------------------------------------
  const nutriologo = await prisma.user.upsert({
    where: { email: EMAIL_NUTRIOLOGO },
    update: { passwordHash, emailVerified: ahora, deletedAt: null },
    create: {
      email: EMAIL_NUTRIOLOGO,
      passwordHash,
      name: `${ETIQUETA} Nutrióloga Demo`,
      role: 'NUTRITIONIST',
      emailVerified: ahora,
      privacyNoticeAcceptedAt: ahora,
      privacyNoticeVersion: VERSION_AVISO,
      nutritionistProfile: {
        create: { nombreCompleto: `${ETIQUETA} Nutrióloga Demo`, marcaNombre: 'Consultorio Demo' },
      },
      subscription: { create: { plan: 'PRO', accessExpiresAt } },
    },
    select: { id: true },
  });

  // El perfil y la suscripción pueden faltar si la cuenta se creó a mano.
  await prisma.nutritionistProfile.upsert({
    where: { userId: nutriologo.id },
    update: {},
    create: { userId: nutriologo.id, nombreCompleto: `${ETIQUETA} Nutrióloga Demo` },
  });
  await prisma.subscription.upsert({
    where: { userId: nutriologo.id },
    update: {},
    create: { userId: nutriologo.id, plan: 'PRO', accessExpiresAt },
  });

  // --- Cuenta del paciente -----------------------------------------------
  const paciente = await prisma.user.upsert({
    where: { email: EMAIL_PACIENTE },
    update: { passwordHash, emailVerified: ahora, deletedAt: null },
    create: {
      email: EMAIL_PACIENTE,
      passwordHash,
      name: `${ETIQUETA} Paciente Demo`,
      role: 'END_USER',
      emailVerified: ahora,
      privacyNoticeAcceptedAt: ahora,
      privacyNoticeVersion: VERSION_AVISO,
    },
    select: { id: true },
  });

  // --- Expedientes --------------------------------------------------------
  // Se borran y recrean para no acumular copias en cada corrida. El borrado en
  // cascada arrastra mediciones, planes y registros de estos expedientes demo.
  await prisma.patient.deleteMany({ where: { nutritionistId: nutriologo.id } });

  const expedienteDemo = await prisma.patient.create({
    data: {
      nutritionistId: nutriologo.id,
      userId: paciente.id,
      nombre: `${ETIQUETA} Paciente Demo`,
      email: EMAIL_PACIENTE,
      genero: 'FEMENINO',
      fechaNacimiento: new Date(Date.UTC(1994, 4, 12)),
      sensitiveDataConsentAt: ahora,
      sensitiveDataConsentVersion: VERSION_AVISO,
      sensitiveDataConsentMethod: 'ELECTRONICO',
      privacyNoticeSentAt: ahora,
      medicalRecord: { create: { nivelActividad: 'MODERADO', objetivo: 'PERDIDA_DE_GRASA' } },
      measurements: {
        create: [
          { fecha: soloFecha(56), pesoKg: 72.4, alturaCm: 165, cinturaCm: 84 },
          { fecha: soloFecha(28), pesoKg: 70.8, alturaCm: 165, cinturaCm: 82 },
          { fecha: soloFecha(7), pesoKg: 69.5, alturaCm: 165, cinturaCm: 80.5 },
        ],
      },
    },
    select: { id: true },
  });

  // Dos expedientes más para que la lista del panel no se vea vacía. Sin cuenta
  // en la app: así se ve también el estado "sin acceso" y el botón de invitar.
  await prisma.patient.createMany({
    data: [
      {
        nutritionistId: nutriologo.id,
        nombre: `${ETIQUETA} Paciente Sin Invitar`,
        email: 'demo.sininvitar@nutria.mx',
        genero: 'MASCULINO',
        sensitiveDataConsentAt: ahora,
        sensitiveDataConsentVersion: VERSION_AVISO,
        sensitiveDataConsentMethod: 'ESCRITO',
      },
      {
        nutritionistId: nutriologo.id,
        nombre: `${ETIQUETA} Paciente Archivado`,
        genero: 'OTRO',
        estado: 'ARCHIVADO',
      },
    ],
  });

  // --- Plan activo, para que la app del paciente muestre contenido ---------
  const plan = await prisma.mealPlan.create({
    data: {
      patientId: expedienteDemo.id,
      estado: 'ACTIVO',
      caloriasDiarias: 1800,
      proteinaG: 115,
      carbosG: 180,
      grasaG: 60,
      nota: 'Plan de ejemplo con datos ficticios, solo para la cuenta demo.',
      activadoAt: hace(14),
      compartidoAt: hace(14),
    },
    select: { id: true },
  });

  const comidas: {
    orden: number;
    nombre: string;
    horario: string;
    items: [string, number, number, number, number][];
  }[] = [
    {
      orden: 1,
      nombre: 'Desayuno',
      horario: '08:00',
      items: [
        ['Avena cocida con leche', 320, 14, 48, 8],
        ['Fruta de temporada', 90, 1, 22, 0],
      ],
    },
    {
      orden: 2,
      nombre: 'Comida',
      horario: '14:00',
      items: [
        ['Pechuga de pollo a la plancha', 280, 45, 0, 10],
        ['Arroz integral', 220, 5, 45, 2],
        ['Ensalada verde con aguacate', 180, 3, 10, 14],
      ],
    },
    {
      orden: 3,
      nombre: 'Cena',
      horario: '20:00',
      items: [
        ['Omelette de dos huevos con espinaca', 240, 18, 4, 17],
        ['Tortillas de maíz', 140, 4, 28, 2],
      ],
    },
  ];

  for (const comida of comidas) {
    await prisma.mealPlanMeal.create({
      data: {
        mealPlanId: plan.id,
        orden: comida.orden,
        nombre: comida.nombre,
        horario: comida.horario,
        items: {
          create: comida.items.map(([descripcion, kcal, proteina, carbos, lipidos]) => ({
            descripcionLibre: descripcion,
            cantidadPorciones: 1,
            energiaKcal: kcal,
            proteinaG: proteina,
            carbohidratosG: carbos,
            lipidosG: lipidos,
          })),
        },
      },
    });
  }

  console.log('Cuentas demo listas:\n');
  console.log(`  Panel del nutriólogo   http://localhost:3000/login`);
  console.log(`    correo      ${EMAIL_NUTRIOLOGO}`);
  console.log(`    contraseña  ${PASSWORD}\n`);
  console.log(`  App del paciente       http://localhost:3001/entrar`);
  console.log(`    correo      ${EMAIL_PACIENTE}`);
  console.log(`    contraseña  ${PASSWORD}\n`);
  console.log('  3 expedientes, plan activo de 1800 kcal y 3 mediciones de peso.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
