import type { Prisma } from '@prisma/client';

import { estructuraPlantillaSchema } from './schemas';
import { leerFoodSnapshot } from './foodSnapshot';

export const planDetalleInclude = {
  meals: {
    orderBy: { orden: 'asc' },
    include: {
      items: {
        include: {
          food: {
            select: {
              id: true,
              nombre: true,
              grupoSmae: true,
              porcionDescripcion: true,
              porcionGramos: true,
              imagenUrl: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.MealPlanInclude;

export type PlanConDetalle = Prisma.MealPlanGetPayload<{
  include: typeof planDetalleInclude;
}>;

export function serializarPlan(plan: PlanConDetalle) {
  return {
    id: plan.id,
    patient_id: plan.patientId,
    estado: plan.estado,
    calorias_diarias: plan.caloriasDiarias,
    proteina_g: plan.proteinaG,
    carbos_g: plan.carbosG,
    grasa_g: plan.grasaG,
    nota: plan.nota,
    origen: plan.origen,
    calculo_snapshot: plan.calculoSnapshot,
    compartido_at: plan.compartidoAt?.toISOString() ?? null,
    pdf_url: plan.pdfUrl,
    created_at: plan.createdAt.toISOString(),
    updated_at: plan.updatedAt.toISOString(),
    comidas: plan.meals.map((comida) => ({
      id: comida.id,
      orden: comida.orden,
      nombre: comida.nombre,
      horario: comida.horario,
      descripcion: comida.descripcion,
      items: comida.items.map((item) => {
        const snapshot = leerFoodSnapshot(item.foodSnapshot);
        const alimento =
          snapshot ??
          (item.food
            ? {
                id: item.food.id,
                nombre: item.food.nombre,
                grupo: item.food.grupoSmae,
                porcion_descripcion: item.food.porcionDescripcion,
                porcion_gramos: item.food.porcionGramos,
                imagen_url: item.food.imagenUrl,
              }
            : null);

        return {
          id: item.id,
          food_id: snapshot?.id ?? item.foodId,
          descripcion_libre: item.descripcionLibre,
          cantidad_porciones: item.cantidadPorciones,
          energia_kcal: item.energiaKcal,
          proteina_g: item.proteinaG,
          carbohidratos_g: item.carbohidratosG,
          lipidos_g: item.lipidosG,
          food: alimento,
        };
      }),
    })),
  };
}

export type PlantillaSerializable = Prisma.PlanTemplateGetPayload<Record<string, never>>;

/** Una estructura antigua o corrupta no debe romper todo el listado. */
function estructuraSegura(valor: unknown) {
  const estructura = estructuraPlantillaSchema.safeParse(valor);
  return estructura.success ? estructura.data : { comidas: [] };
}

export function serializarPlantilla(plantilla: PlantillaSerializable) {
  return {
    id: plantilla.id,
    nombre: plantilla.nombre,
    objetivo: plantilla.objetivo,
    calorias: plantilla.calorias,
    descripcion: plantilla.descripcion,
    estructura: estructuraSegura(plantilla.estructura),
    created_at: plantilla.createdAt.toISOString(),
    updated_at: plantilla.updatedAt.toISOString(),
  };
}
