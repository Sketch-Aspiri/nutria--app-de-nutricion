import { PrismaClient } from '@prisma/client';
import type { Page } from '@playwright/test';
import { hash } from 'bcryptjs';

/**
 * Utilidades de preparación para los tests E2E.
 *
 * Las cuentas se crean directamente en la base (ya verificadas) para no
 * depender del correo, y se borran al terminar. Los datos son ficticios:
 * nunca se usan datos reales de pacientes en fixtures.
 */

export const prisma = new PrismaClient();

export const PASSWORD_PRUEBA = 'contrasena-de-prueba-e2e';

export type CuentaPrueba = {
  id: string;
  email: string;
  nombre: string;
};

/** Correo único por corrida para que dos ejecuciones no colisionen. */
function emailUnico(prefijo: string): string {
  const sufijo = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-${prefijo}-${sufijo}@nutria.test`;
}

export async function crearNutriologo(prefijo: string, nombre: string): Promise<CuentaPrueba> {
  const email = emailUnico(prefijo);
  const passwordHash = await hash(PASSWORD_PRUEBA, 10);

  const usuario = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: nombre,
      role: 'NUTRITIONIST',
      emailVerified: new Date(),
      nutritionistProfile: { create: { nombreCompleto: nombre } },
      subscription: { create: {} },
    },
    select: { id: true },
  });

  return { id: usuario.id, email, nombre };
}

/** El borrado en cascada arrastra pacientes, expedientes y mediciones. */
export async function borrarCuentas(...cuentas: CuentaPrueba[]): Promise<void> {
  await prisma.user.deleteMany({
    where: { id: { in: cuentas.map((c) => c.id) } },
  });
}

export async function iniciarSesion(page: Page, cuenta: CuentaPrueba): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(cuenta.email);
  await page.getByLabel('Contraseña').fill(PASSWORD_PRUEBA);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL('**/pacientes');
}

/** Alta de paciente por API, para tests que no ejercitan el asistente. */
export async function crearPacienteEnBase(
  nutritionistId: string,
  nombre: string,
): Promise<{ id: string }> {
  return prisma.patient.create({
    data: {
      nutritionistId,
      nombre,
      genero: 'FEMENINO',
      medicalRecord: { create: { objetivo: 'PERDIDA_DE_GRASA' } },
      foodPreference: { create: {} },
    },
    select: { id: true },
  });
}
