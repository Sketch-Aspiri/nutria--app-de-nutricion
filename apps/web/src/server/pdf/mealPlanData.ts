import type { MealPlanPdfData } from '@/components/pdf/MealPlanDocument';
import { leerFoodSnapshot } from '@/server/plans/foodSnapshot';
import type { PlanParaPdf } from '@/server/plans/repository';
import { logoSeguro } from '@/server/profile/logoSafety';
import { cargarLogoMarcaParaPdf } from '@/server/profile/logoStorage';

const COLOR_PREDETERMINADO = '#065f46';
export { logoSeguro };

/** Traduce el agregado Prisma al contrato pequeño y estable del renderer. */
export async function crearDatosPlanPdf(
  plan: PlanParaPdf,
  generadoEn = new Date(),
  resolverLogo = cargarLogoMarcaParaPdf,
): Promise<MealPlanPdfData> {
  const perfil = plan.patient.nutritionist.nutritionistProfile;
  const profesional =
    perfil?.nombreCompleto || plan.patient.nutritionist.name || 'Profesional de nutrición';
  const logoUrl = await resolverLogo(
    perfil?.marcaLogoUrl ?? null,
    plan.patient.nutritionist.id,
  );

  return {
    generadoEn,
    marca: {
      nombre: perfil?.marcaNombre || perfil?.nombreCompleto || 'nutria',
      color: perfil?.marcaColor || COLOR_PREDETERMINADO,
      logoUrl,
      profesional,
      cedulaProfesional: perfil?.cedulaProfesional ?? null,
      especialidad: perfil?.especialidad ?? null,
    },
    paciente: { nombre: plan.patient.nombre },
    plan: {
      caloriasDiarias: plan.caloriasDiarias,
      proteinaG: plan.proteinaG,
      carbosG: plan.carbosG,
      grasaG: plan.grasaG,
      nota: plan.nota,
      comidas: plan.meals.map((comida) => ({
        id: comida.id,
        nombre: comida.nombre,
        horario: comida.horario,
        descripcion: comida.descripcion,
        items: comida.items.map((item) => {
          const snapshot = leerFoodSnapshot(item.foodSnapshot);
          return {
            id: item.id,
            nombre:
              snapshot?.nombre ||
              item.food?.nombre ||
              item.descripcionLibre ||
              'Alimento',
            porcion: snapshot
              ? `${snapshot.porcion_descripcion} (${snapshot.porcion_gramos} g)`
              : item.food
                ? `${item.food.porcionDescripcion} (${item.food.porcionGramos} g)`
                : '',
            cantidadPorciones: item.cantidadPorciones,
            energiaKcal: item.energiaKcal,
            proteinaG: item.proteinaG,
            carbohidratosG: item.carbohidratosG,
            lipidosG: item.lipidosG,
          };
        }),
      })),
    },
  };
}

/** Nombre legible y ASCII para Content-Disposition. */
export function nombreArchivoPlan(nombrePaciente: string): string {
  const paciente = nombrePaciente
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  return paciente ? `plan-alimenticio-${paciente}.pdf` : 'plan-alimenticio.pdf';
}
