import type { Food, Prisma } from '@prisma/client';
import { z } from 'zod';

const foodSnapshotSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1),
  grupo: z.string(),
  porcion_descripcion: z.string(),
  porcion_gramos: z.number(),
  imagen_url: z.string().nullable(),
});

export type FoodSnapshot = z.infer<typeof foodSnapshotSchema>;

export function crearFoodSnapshot(alimento: Food): Prisma.InputJsonValue {
  return {
    id: alimento.id,
    nombre: alimento.nombre,
    grupo: alimento.grupoSmae,
    porcion_descripcion: alimento.porcionDescripcion,
    porcion_gramos: alimento.porcionGramos,
    imagen_url: alimento.imagenUrl,
  };
}

/** Tolera filas legacy/corruptas y permite el fallback temporal a la relación. */
export function leerFoodSnapshot(valor: unknown): FoodSnapshot | null {
  const resultado = foodSnapshotSchema.safeParse(valor);
  return resultado.success ? resultado.data : null;
}
