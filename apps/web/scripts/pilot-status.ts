import { prisma } from '../src/server/db';
import { calcularOnboarding } from '../src/server/onboarding';

function correosPiloto(): string[] {
  const correos = (process.env.PILOT_EMAILS ?? '')
    .split(',')
    .map((correo) => correo.trim().toLowerCase())
    .filter(Boolean);

  if (correos.length < 3 || correos.length > 5) {
    throw new Error('PILOT_EMAILS debe contener entre 3 y 5 correos separados por coma.');
  }
  if (new Set(correos).size !== correos.length) {
    throw new Error('PILOT_EMAILS contiene cuentas duplicadas.');
  }
  return correos;
}

function etiquetaPiloto(indice: number): string {
  return `piloto-${String(indice + 1).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  const correos = correosPiloto();
  const usuarios = await prisma.user.findMany({
    where: { email: { in: correos }, deletedAt: null },
    select: {
      email: true,
      emailVerified: true,
      privacyNoticeAcceptedAt: true,
      nutritionistProfile: {
        select: { cedulaProfesional: true, especialidad: true, telefono: true },
      },
      _count: { select: { patients: true, appointments: true } },
      patients: {
        where: { deletedAt: null },
        select: { _count: { select: { mealPlans: true } } },
      },
    },
  });
  const porCorreo = new Map(usuarios.map((usuario) => [usuario.email.toLowerCase(), usuario]));
  let completos = 0;

  const resumen = correos.map((correo, indice) => {
    const usuario = porCorreo.get(correo);
    const avance = usuario
      ? calcularOnboarding({
          perfilProfesionalCompleto: Boolean(
            usuario.nutritionistProfile?.cedulaProfesional &&
              usuario.nutritionistProfile.especialidad &&
              usuario.nutritionistProfile.telefono,
          ),
          pacientes: usuario._count.patients,
          planes: usuario.patients.reduce(
            (total, paciente) => total + paciente._count.mealPlans,
            0,
          ),
          citas: usuario._count.appointments,
        })
      : null;
    if (avance?.porcentaje === 100) completos += 1;

    return {
      piloto: etiquetaPiloto(indice),
      cuenta: usuario ? 'creada' : 'pendiente',
      correoVerificado: Boolean(usuario?.emailVerified),
      avisoAceptado: Boolean(usuario?.privacyNoticeAcceptedAt),
      onboarding: avance ? `${avance.porcentaje}%` : '0%',
    };
  });

  console.table(resumen);
  console.info(`Cohorte: ${correos.length} · onboarding completo: ${completos}/${correos.length}`);
  if (usuarios.length !== correos.length || completos !== correos.length) process.exitCode = 2;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'No se pudo verificar la cohorte.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
