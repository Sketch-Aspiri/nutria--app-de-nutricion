import { Prisma, type Food, type PlanTemplate } from '@prisma/client';

import { tieneConflictoAlergia } from '@nutria/shared';

import { prisma } from '@/server/db';

import {
  type ActualizarPlanInput,
  type ActualizarPlantillaInput,
  type ComidaPlanInput,
  type CrearPlanInput,
  type CrearPlantillaInput,
  estructuraPlantillaSchema,
  type FiltroPlanesInput,
} from './schemas';
import {
  type PlanConDetalle,
  planDetalleInclude,
} from './serializers';
import { crearFoodSnapshot, leerFoodSnapshot } from './foodSnapshot';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ClienteTransaccion = Prisma.TransactionClient;
type SnapshotItemPlan = Prisma.MealPlanItemGetPayload<Record<string, never>>;
type ComidaPersistida = Prisma.MealPlanMealGetPayload<{
  include: { items: true };
}>;

export class AlimentoDePlanNoEncontradoError extends Error {
  constructor() {
    super('ALIMENTO_DE_PLAN_NO_ENCONTRADO');
    this.name = 'AlimentoDePlanNoEncontradoError';
  }
}

export class PlantillaDePlanNoEncontradaError extends Error {
  constructor() {
    super('PLANTILLA_DE_PLAN_NO_ENCONTRADA');
    this.name = 'PlantillaDePlanNoEncontradaError';
  }
}

export class AlergenoEnPlanError extends Error {
  constructor() {
    super('ALERGENO_EN_PLAN');
    this.name = 'AlergenoEnPlanError';
  }
}

export class PlanIncompletoError extends Error {
  constructor() {
    super('PLAN_INCOMPLETO');
    this.name = 'PlanIncompletoError';
  }
}

export class DesviacionEnergeticaPlanError extends Error {
  constructor() {
    super('DESVIACION_ENERGETICA_PLAN');
    this.name = 'DesviacionEnergeticaPlanError';
  }
}

export class PlanNoEditableError extends Error {
  constructor() {
    super('PLAN_NO_EDITABLE');
    this.name = 'PlanNoEditableError';
  }
}

export class EstructuraPlanInvalidaError extends Error {
  constructor() {
    super('ESTRUCTURA_PLAN_INVALIDA');
    this.name = 'EstructuraPlanInvalidaError';
  }
}

export class VersionPlanObsoletaError extends Error {
  constructor() {
    super('VERSION_PLAN_OBSOLETA');
    this.name = 'VersionPlanObsoletaError';
  }
}

export type ResultadoListaPlanes = {
  planes: PlanConDetalle[];
  total: number;
};

export async function listarPlanes(
  nutritionistId: string,
  patientId: string,
  paginacion: { skip: number; take: number },
  filtros: FiltroPlanesInput,
): Promise<ResultadoListaPlanes | null> {
  if (!esIdValido(patientId)) return null;

  const paciente = await prisma.patient.findFirst({
    where: { id: patientId, nutritionistId, deletedAt: null },
    select: { id: true },
  });
  if (!paciente) return null;

  const where: Prisma.MealPlanWhereInput = {
    patientId,
    patient: { nutritionistId, deletedAt: null },
    ...(filtros.estado ? { estado: filtros.estado } : {}),
  };
  const [planes, total] = await Promise.all([
    prisma.mealPlan.findMany({
      where,
      include: planDetalleInclude,
      orderBy: { createdAt: 'desc' },
      skip: paginacion.skip,
      take: paginacion.take,
    }),
    prisma.mealPlan.count({ where }),
  ]);

  return { planes, total };
}

export async function buscarPlan(
  nutritionistId: string,
  id: string,
): Promise<PlanConDetalle | null> {
  if (!esIdValido(id)) return null;

  return prisma.mealPlan.findFirst({
    where: { id, patient: { nutritionistId, deletedAt: null } },
    include: planDetalleInclude,
  });
}

/**
 * Lectura para el renderer PDF. Incluye la marca del dueño sin relajar el
 * filtro de pertenencia del plan.
 */
export const planParaPdfInclude = {
  ...planDetalleInclude,
  patient: {
    select: {
      nombre: true,
      nutritionist: {
        select: {
          id: true,
          name: true,
          nutritionistProfile: {
            select: {
              nombreCompleto: true,
              cedulaProfesional: true,
              especialidad: true,
              marcaNombre: true,
              marcaColor: true,
              marcaLogoUrl: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.MealPlanInclude;

export type PlanParaPdf = Prisma.MealPlanGetPayload<{
  include: typeof planParaPdfInclude;
}>;

export async function buscarPlanParaPdf(
  nutritionistId: string,
  id: string,
): Promise<PlanParaPdf | null> {
  if (!esIdValido(id)) return null;

  return prisma.mealPlan.findFirst({
    where: { id, patient: { nutritionistId, deletedAt: null } },
    include: planParaPdfInclude,
  });
}

/**
 * Presupuesto de tiempo de las transacciones de planes.
 *
 * Prisma corta las transacciones interactivas a los 5 s por omisión, y un plan
 * se escribe con un `create` anidado que emite un INSERT por comida y otro por
 * item. Contra una base gestionada (Neon), con ~80 ms de ida y vuelta, un
 * borrador de la IA con cinco tiempos y seis alimentos cada uno se lleva esos
 * 5 s solo en latencia y muere con P2028, que el usuario ve como "Ocurrió un
 * error inesperado".
 *
 * Reintentar no sirve —el trabajo es el mismo— así que se sube el techo. El
 * tamaño está acotado por `MAX_COMIDAS_PLAN`/`MAX_ITEMS_PLAN`, de modo que el
 * peor caso es finito y no una transacción que se queda abierta indefinidamente.
 */
export const OPCIONES_TRANSACCION_PLAN = {
  /** Espera por una conexión libre del pool antes de rendirse. */
  maxWait: 10_000,
  /** Tiempo máximo de la transacción ya iniciada. */
  timeout: 30_000,
} as const;

export function crearPlan(
  nutritionistId: string,
  patientId: string,
  datos: CrearPlanInput,
): Promise<PlanConDetalle | null> {
  if (!esIdValido(patientId)) return Promise.resolve(null);

  return transaccionSerializable(async (tx) => {
    const paciente = await tx.patient.findFirst({
      where: { id: patientId, nutritionistId, deletedAt: null },
      select: { id: true },
    });
    if (!paciente) return null;

    let plantilla: PlanTemplate | null = null;
    let comidas = datos.comidas;
    if (datos.plantilla_id) {
      plantilla = await tx.planTemplate.findFirst({
        where: { id: datos.plantilla_id, nutritionistId },
      });
      if (!plantilla) throw new PlantillaDePlanNoEncontradaError();

      if (comidas === undefined) {
        const estructura = estructuraPlantillaSchema.safeParse(
          plantilla.estructura,
        );
        if (!estructura.success) throw new PlantillaDePlanNoEncontradaError();
        comidas = estructura.data.comidas;
      }
    }

    const comidasMaterializadas = await materializarComidas(
      tx,
      nutritionistId,
      comidas ?? [],
    );
    const macrosPlantilla = datos.plantilla_id
      ? sumarMacrosComidas(comidas ?? [])
      : null;
    const estadoSolicitado = datos.estado ?? 'BORRADOR';
    const creado = await tx.mealPlan.create({
      data: {
        patient: { connect: { id: patientId } },
        // La activación pasa después por las validaciones clínicas.
        estado:
          estadoSolicitado === 'ACTIVO' ? 'BORRADOR' : estadoSolicitado,
        caloriasDiarias:
          datos.calorias_diarias ?? plantilla?.calorias ?? 0,
        proteinaG: datos.proteina_g ?? macrosPlantilla?.proteinaG ?? 0,
        carbosG: datos.carbos_g ?? macrosPlantilla?.carbosG ?? 0,
        grasaG: datos.grasa_g ?? macrosPlantilla?.grasaG ?? 0,
        nota: datos.nota ?? null,
        origen: datos.plantilla_id
          ? 'PLANTILLA'
          : (datos.origen ?? 'MANUAL'),
        meals: { create: comidasMaterializadas },
      },
      include: planDetalleInclude,
    });
    if (estadoSolicitado === 'ACTIVO') {
      return activarPlanEnTransaccion(tx, nutritionistId, creado.id);
    }
    return creado;
  });
}

export function actualizarPlan(
  nutritionistId: string,
  id: string,
  datos: ActualizarPlanInput,
): Promise<PlanConDetalle | null> {
  if (!esIdValido(id)) return Promise.resolve(null);

  return transaccionSerializable(async (tx) => {
    const existente = await tx.mealPlan.findFirst({
      where: { id, patient: { nutritionistId, deletedAt: null } },
      include: { meals: { include: { items: true } } },
    });
    if (!existente) return null;
    if (existente.estado !== 'BORRADOR') throw new PlanNoEditableError();
    if (
      existente.updatedAt.getTime() !==
      new Date(datos.expected_updated_at).getTime()
    ) {
      throw new VersionPlanObsoletaError();
    }

    const data: Prisma.MealPlanUpdateInput = {
      ...(datos.calorias_diarias !== undefined
        ? { caloriasDiarias: datos.calorias_diarias }
        : {}),
      ...(datos.proteina_g !== undefined ? { proteinaG: datos.proteina_g } : {}),
      ...(datos.carbos_g !== undefined ? { carbosG: datos.carbos_g } : {}),
      ...(datos.grasa_g !== undefined ? { grasaG: datos.grasa_g } : {}),
      ...(datos.nota !== undefined ? { nota: datos.nota ?? null } : {}),
      ...(datos.origen !== undefined ? { origen: datos.origen } : {}),
      ...(datos.estado !== undefined && datos.estado !== 'ACTIVO'
        ? { estado: datos.estado }
        : {}),
    };

    if (datos.comidas !== undefined) {
      validarIdsDeEstructura(existente.meals, datos.comidas);
      if (!estructuraSinCambios(existente.meals, datos.comidas)) {
        const snapshots = new Map(
          existente.meals.flatMap((comida) =>
            comida.items.map((item) => [item.id, item] as const),
          ),
        );
        const comidas = await materializarComidas(
          tx,
          nutritionistId,
          datos.comidas,
          snapshots,
        );
        await tx.mealPlanMeal.deleteMany({ where: { mealPlanId: id } });
        data.meals = { create: comidas };
      }
    }

    await tx.mealPlan.update({
      where: { id },
      data,
    });

    const estadoFinal = datos.estado ?? existente.estado;
    if (estadoFinal === 'ACTIVO') {
      return activarPlanEnTransaccion(tx, nutritionistId, id);
    }

    return tx.mealPlan.findUniqueOrThrow({
      where: { id },
      include: planDetalleInclude,
    });
  });
}

export async function archivarPlan(
  nutritionistId: string,
  id: string,
): Promise<boolean> {
  if (!esIdValido(id)) return false;

  const actualizado = await prisma.mealPlan.updateMany({
    where: { id, patient: { nutritionistId, deletedAt: null } },
    data: { estado: 'ARCHIVADO' },
  });
  return actualizado.count > 0;
}

/**
 * Compartir hace activo el plan en la misma transacción. Así un reintento del
 * cliente no puede dejar dos planes activos ni compartir un borrador obsoleto.
 */
export function compartirPlan(
  nutritionistId: string,
  id: string,
): Promise<PlanConDetalle | null> {
  if (!esIdValido(id)) return Promise.resolve(null);

  return transaccionSerializable(async (tx) => {
    const existente = await tx.mealPlan.findFirst({
      where: { id, patient: { nutritionistId, deletedAt: null } },
      select: { estado: true },
    });
    if (!existente) return null;

    if (existente.estado === 'ACTIVO') {
      await validarPlanActivable(tx, nutritionistId, id);
    } else {
      await activarPlanEnTransaccion(tx, nutritionistId, id);
    }
    return tx.mealPlan.update({
      where: { id },
      data: { compartidoAt: new Date() },
      include: planDetalleInclude,
    });
  });
}

/** Activa sin compartir; la fecha de envío permanece intacta. */
export function activarPlan(
  nutritionistId: string,
  id: string,
): Promise<PlanConDetalle | null> {
  if (!esIdValido(id)) return Promise.resolve(null);

  return transaccionSerializable(async (tx) => {
    const existente = await tx.mealPlan.findFirst({
      where: { id, patient: { nutritionistId, deletedAt: null } },
      select: { id: true },
    });
    if (!existente) return null;
    return activarPlanEnTransaccion(tx, nutritionistId, id);
  });
}

export function duplicarPlan(
  nutritionistId: string,
  id: string,
): Promise<PlanConDetalle | null> {
  if (!esIdValido(id)) return Promise.resolve(null);

  return prisma.$transaction(async (tx) => {
    const original = await tx.mealPlan.findFirst({
      where: { id, patient: { nutritionistId, deletedAt: null } },
      include: planDetalleInclude,
    });
    if (!original) return null;

    return tx.mealPlan.create({
      data: {
        patient: { connect: { id: original.patientId } },
        estado: 'BORRADOR',
        caloriasDiarias: original.caloriasDiarias,
        proteinaG: original.proteinaG,
        carbosG: original.carbosG,
        grasaG: original.grasaG,
        nota: original.nota,
        origen: original.origen,
        ...(original.calculoSnapshot !== null
          ? { calculoSnapshot: comoJsonPrisma(original.calculoSnapshot) }
          : {}),
        meals: {
          create: original.meals.map((comida) => ({
            orden: comida.orden,
            nombre: comida.nombre,
            horario: comida.horario,
            descripcion: comida.descripcion,
            items: {
              create: comida.items.map((item) => ({
                ...(item.foodId ? { food: { connect: { id: item.foodId } } } : {}),
                ...(item.foodSnapshot !== null
                  ? { foodSnapshot: comoJsonPrisma(item.foodSnapshot) }
                  : {}),
                descripcionLibre: item.descripcionLibre,
                cantidadPorciones: item.cantidadPorciones,
                energiaKcal: item.energiaKcal,
                proteinaG: item.proteinaG,
                carbohidratosG: item.carbohidratosG,
                lipidosG: item.lipidosG,
              })),
            },
          })),
        },
      },
      include: planDetalleInclude,
    });
  }, OPCIONES_TRANSACCION_PLAN);
}

export async function listarPlantillas(
  nutritionistId: string,
  paginacion: { skip: number; take: number },
): Promise<{ plantillas: PlanTemplate[]; total: number }> {
  const where: Prisma.PlanTemplateWhereInput = { nutritionistId };
  const [plantillas, total] = await Promise.all([
    prisma.planTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: paginacion.skip,
      take: paginacion.take,
    }),
    prisma.planTemplate.count({ where }),
  ]);
  return { plantillas, total };
}

export async function buscarPlantilla(
  nutritionistId: string,
  id: string,
): Promise<PlanTemplate | null> {
  if (!esIdValido(id)) return null;
  return prisma.planTemplate.findFirst({ where: { id, nutritionistId } });
}

export function crearPlantilla(
  nutritionistId: string,
  datos: CrearPlantillaInput,
): Promise<PlanTemplate> {
  return prisma.$transaction(async (tx) => {
    const estructura = await materializarEstructuraPlantilla(
      tx,
      nutritionistId,
      datos.estructura,
    );
    return tx.planTemplate.create({
      data: {
        nutritionist: { connect: { id: nutritionistId } },
        nombre: datos.nombre,
        objetivo: datos.objetivo,
        calorias: datos.calorias,
        descripcion: datos.descripcion ?? null,
        estructura: comoJsonPrisma(estructura),
      },
    });
  }, OPCIONES_TRANSACCION_PLAN);
}

export async function actualizarPlantilla(
  nutritionistId: string,
  id: string,
  datos: ActualizarPlantillaInput,
): Promise<PlanTemplate | null> {
  if (!esIdValido(id)) return null;

  return prisma.$transaction(async (tx) => {
    const estructura =
      datos.estructura === undefined
        ? undefined
        : await materializarEstructuraPlantilla(
            tx,
            nutritionistId,
            datos.estructura,
          );
    const actualizada = await tx.planTemplate.updateMany({
      where: { id, nutritionistId },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
        ...(datos.objetivo !== undefined ? { objetivo: datos.objetivo } : {}),
        ...(datos.calorias !== undefined ? { calorias: datos.calorias } : {}),
        ...(datos.descripcion !== undefined
          ? { descripcion: datos.descripcion ?? null }
          : {}),
        ...(estructura !== undefined
          ? { estructura: comoJsonPrisma(estructura) }
          : {}),
      },
    });
    if (actualizada.count === 0) return null;

    return tx.planTemplate.findUnique({ where: { id } });
  }, OPCIONES_TRANSACCION_PLAN);
}

export async function borrarPlantilla(
  nutritionistId: string,
  id: string,
): Promise<boolean> {
  if (!esIdValido(id)) return false;

  const eliminada = await prisma.planTemplate.deleteMany({
    where: { id, nutritionistId },
  });
  return eliminada.count > 0;
}

function esIdValido(id: string): boolean {
  return UUID.test(id);
}

/**
 * PostgreSQL puede abortar una de dos activaciones concurrentes bajo
 * SERIALIZABLE (P2034). Se reintenta de forma acotada para conservar la
 * garantía de un solo plan activo sin trasladar el conflicto al usuario.
 */
async function transaccionSerializable<T>(
  operacion: (tx: ClienteTransaccion) => Promise<T>,
): Promise<T> {
  const intentos = 3;
  for (let intento = 1; ; intento += 1) {
    try {
      return await prisma.$transaction(operacion, {
        ...OPCIONES_TRANSACCION_PLAN,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      const reintentable =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034';
      if (!reintentable || intento === intentos) throw error;
    }
  }
}

function comoJsonPrisma(valor: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (valor === null || valor === undefined) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

async function archivarPlanesActivos(
  tx: ClienteTransaccion,
  patientId: string,
  exceptoId?: string,
) {
  await tx.mealPlan.updateMany({
    where: {
      patientId,
      estado: 'ACTIVO',
      ...(exceptoId ? { id: { not: exceptoId } } : {}),
    },
    data: { estado: 'ARCHIVADO' },
  });
}

async function activarPlanEnTransaccion(
  tx: ClienteTransaccion,
  nutritionistId: string,
  id: string,
): Promise<PlanConDetalle> {
  const plan = await validarPlanActivable(tx, nutritionistId, id);
  await archivarPlanesActivos(tx, plan.patientId, id);

  return tx.mealPlan.update({
    where: { id },
    // `activadoAt` es el día desde el que la adherencia mide. Reactivar un plan
    // archivado reinicia la cuenta, que es lo correcto: el paciente no debe
    // arrastrar los días en que ese plan no estuvo vigente.
    data: { estado: 'ACTIVO', activadoAt: new Date() },
    include: planDetalleInclude,
  });
}

const planAlergenosInclude = {
  patient: { include: { foodPreference: true } },
  meals: {
    include: {
      items: {
        include: { food: { select: { nombre: true } } },
      },
    },
  },
} satisfies Prisma.MealPlanInclude;

async function validarPlanActivable(
  tx: ClienteTransaccion,
  nutritionistId: string,
  id: string,
) {
  const plan = await tx.mealPlan.findFirstOrThrow({
    where: { id, patient: { nutritionistId, deletedAt: null } },
    include: planAlergenosInclude,
  });
  const alergias = comoListaDeTexto(plan.patient.foodPreference?.alergias);
  const tieneContenido = plan.meals.some((comida) =>
    comida.items.some(
      (item) =>
        item.food !== null ||
        leerFoodSnapshot(item.foodSnapshot) !== null ||
        Boolean(item.descripcionLibre?.trim()),
    ),
  );
  if (plan.caloriasDiarias <= 0 || plan.meals.length === 0 || !tieneContenido) {
    throw new PlanIncompletoError();
  }

  const energiaTotal = plan.meals.reduce(
    (totalComidas, comida) =>
      totalComidas +
      comida.items.reduce(
        (totalItems, item) => totalItems + item.energiaKcal,
        0,
      ),
    0,
  );
  const desviacionEnergetica =
    Math.abs(energiaTotal - plan.caloriasDiarias) / plan.caloriasDiarias;
  if (desviacionEnergetica > 0.05) {
    throw new DesviacionEnergeticaPlanError();
  }

  const conflicto = plan.meals.some(
    (comida) =>
      tieneConflictoAlergia(comida.nombre, alergias) ||
      tieneConflictoAlergia(comida.descripcion, alergias) ||
      comida.items.some(
        (item) => {
          const snapshot = leerFoodSnapshot(item.foodSnapshot);
          return (
            tieneConflictoAlergia(snapshot?.nombre ?? item.food?.nombre, alergias) ||
            tieneConflictoAlergia(item.descripcionLibre, alergias)
          );
        },
      ),
  );
  if (conflicto) throw new AlergenoEnPlanError();
  return plan;
}

function comoListaDeTexto(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is string => typeof item === 'string');
}

function sumarMacrosComidas(comidas: ComidaPlanInput[]) {
  const totales = comidas.reduce(
    (acumulado, comida) =>
      comida.items.reduce(
        (subtotal, item) => ({
          proteinaG: subtotal.proteinaG + (item.proteina_g ?? 0),
          carbosG: subtotal.carbosG + (item.carbohidratos_g ?? 0),
          grasaG: subtotal.grasaG + (item.lipidos_g ?? 0),
        }),
        acumulado,
      ),
    { proteinaG: 0, carbosG: 0, grasaG: 0 },
  );

  return {
    proteinaG: Math.round(totales.proteinaG),
    carbosG: Math.round(totales.carbosG),
    grasaG: Math.round(totales.grasaG),
  };
}

function validarIdsDeEstructura(
  existentes: ComidaPersistida[],
  recibidas: ComidaPlanInput[],
): void {
  const comidasExistentes = new Set(existentes.map((comida) => comida.id));
  const itemsExistentes = new Set(
    existentes.flatMap((comida) => comida.items.map((item) => item.id)),
  );
  const comidasRecibidas = new Set<string>();
  const itemsRecibidos = new Set<string>();

  for (const comida of recibidas) {
    if (comida.id) {
      if (comidasRecibidas.has(comida.id) || !comidasExistentes.has(comida.id)) {
        throw new EstructuraPlanInvalidaError();
      }
      comidasRecibidas.add(comida.id);
    }
    for (const item of comida.items) {
      if (!item.id) continue;
      if (itemsRecibidos.has(item.id) || !itemsExistentes.has(item.id)) {
        throw new EstructuraPlanInvalidaError();
      }
      itemsRecibidos.add(item.id);
    }
  }
}

function estructuraSinCambios(
  existentes: ComidaPersistida[],
  recibidas: ComidaPlanInput[],
): boolean {
  if (existentes.length !== recibidas.length) return false;
  const comidasPorId = new Map(existentes.map((comida) => [comida.id, comida]));

  return recibidas.every((comida, indice) => {
    if (!comida.id) return false;
    const existente = comidasPorId.get(comida.id);
    if (!existente || existente.items.length !== comida.items.length) return false;
    if (
      existente.orden !== (comida.orden ?? indice) ||
      existente.nombre !== comida.nombre ||
      (existente.horario ?? null) !== (comida.horario ?? null) ||
      (existente.descripcion ?? null) !== (comida.descripcion ?? null)
    ) {
      return false;
    }

    const itemsPorId = new Map(
      existente.items.map((item) => [item.id, item]),
    );
    return comida.items.every((item) => {
      if (!item.id) return false;
      const guardado = itemsPorId.get(item.id);
      return Boolean(
        guardado &&
          (guardado.foodId ?? null) === (item.food_id ?? null) &&
          (guardado.descripcionLibre ?? null) ===
            (item.descripcion_libre ?? null) &&
          guardado.cantidadPorciones === item.cantidad_porciones &&
          guardado.energiaKcal === (item.energia_kcal ?? 0) &&
          guardado.proteinaG === (item.proteina_g ?? 0) &&
          guardado.carbohidratosG === (item.carbohidratos_g ?? 0) &&
          guardado.lipidosG === (item.lipidos_g ?? 0),
      );
    });
  });
}

async function materializarComidas(
  tx: ClienteTransaccion,
  nutritionistId: string,
  comidas: ComidaPlanInput[],
  snapshots = new Map<string, SnapshotItemPlan>(),
): Promise<Prisma.MealPlanMealCreateWithoutMealPlanInput[]> {
  const alimentosPorId = await resolverAlimentos(
    tx,
    nutritionistId,
    comidas,
    snapshots,
  );

  return comidas.map((comida, indice) => ({
    orden: comida.orden ?? indice,
    nombre: comida.nombre,
    horario: comida.horario ?? null,
    descripcion: comida.descripcion ?? null,
    items: {
      create: comida.items.map((item) =>
        materializarItem(
          item,
          item.food_id ? alimentosPorId.get(item.food_id) : undefined,
          item.id ? snapshots.get(item.id) : undefined,
        ),
      ),
    },
  }));
}

async function resolverAlimentos(
  tx: ClienteTransaccion,
  nutritionistId: string,
  comidas: ComidaPlanInput[],
  snapshots = new Map<string, SnapshotItemPlan>(),
): Promise<Map<string, Food>> {
  const ids = [
    ...new Set(
      comidas.flatMap((comida) =>
        comida.items.flatMap((item) => {
          if (!item.food_id) return [];
          const snapshot = item.id ? snapshots.get(item.id) : undefined;
          const foodHistorico = leerFoodSnapshot(snapshot?.foodSnapshot);
          return snapshot?.foodId === item.food_id ||
            foodHistorico?.id === item.food_id
            ? []
            : [item.food_id];
        }),
      ),
    ),
  ];
  const alimentos =
    ids.length === 0
      ? []
      : await tx.food.findMany({
          where: {
            id: { in: ids },
            deletedAt: null,
            OR: [
              { esPublico: true, nutritionistId: null },
              { nutritionistId },
            ],
          },
        });
  const alimentosPorId = new Map(alimentos.map((alimento) => [alimento.id, alimento]));
  if (alimentosPorId.size !== ids.length) {
    throw new AlimentoDePlanNoEncontradoError();
  }

  return alimentosPorId;
}

function materializarItem(
  item: ComidaPlanInput['items'][number],
  alimento: Food | undefined,
  snapshot: SnapshotItemPlan | undefined,
): Prisma.MealPlanItemCreateWithoutMealInput {
  const foodHistorico = leerFoodSnapshot(snapshot?.foodSnapshot);
  const reutilizaSnapshot = Boolean(
    snapshot &&
      item.food_id &&
      (snapshot.foodId === item.food_id ||
        foodHistorico?.id === item.food_id),
  );
  if (reutilizaSnapshot && snapshot) {
    const factor =
      snapshot.cantidadPorciones > 0
        ? item.cantidad_porciones / snapshot.cantidadPorciones
        : item.cantidad_porciones;
    return {
      ...(snapshot.foodId
        ? { food: { connect: { id: snapshot.foodId } } }
        : {}),
      ...(snapshot.foodSnapshot !== null
        ? { foodSnapshot: comoJsonPrisma(snapshot.foodSnapshot) }
        : {}),
      descripcionLibre: item.descripcion_libre ?? null,
      cantidadPorciones: item.cantidad_porciones,
      energiaKcal: escalar(snapshot.energiaKcal, factor),
      proteinaG: escalar(snapshot.proteinaG, factor),
      carbohidratosG: escalar(snapshot.carbohidratosG, factor),
      lipidosG: escalar(snapshot.lipidosG, factor),
    };
  }

  if (alimento) {
    return {
      food: { connect: { id: alimento.id } },
      foodSnapshot: crearFoodSnapshot(alimento),
      descripcionLibre: item.descripcion_libre ?? null,
      cantidadPorciones: item.cantidad_porciones,
      energiaKcal: escalar(alimento.energiaKcal, item.cantidad_porciones),
      proteinaG: escalar(alimento.proteinaG, item.cantidad_porciones),
      carbohidratosG: escalar(alimento.carbohidratosG, item.cantidad_porciones),
      lipidosG: escalar(alimento.lipidosG, item.cantidad_porciones),
    };
  }

  return {
    descripcionLibre: item.descripcion_libre ?? null,
    cantidadPorciones: item.cantidad_porciones,
    // El schema exige los cuatro campos para un item libre.
    energiaKcal: item.energia_kcal ?? 0,
    proteinaG: item.proteina_g ?? 0,
    carbohidratosG: item.carbohidratos_g ?? 0,
    lipidosG: item.lipidos_g ?? 0,
  };
}

/** Evita ruido binario al multiplicar por medias porciones. */
function escalar(valor: number, porciones: number): number {
  return Number((valor * porciones).toFixed(4));
}

async function materializarEstructuraPlantilla(
  tx: ClienteTransaccion,
  nutritionistId: string,
  estructura: CrearPlantillaInput['estructura'],
) {
  const alimentos = await resolverAlimentos(
    tx,
    nutritionistId,
    estructura.comidas,
  );

  return {
    comidas: estructura.comidas.map((comida, indice) => ({
      orden: comida.orden ?? indice,
      nombre: comida.nombre,
      horario: comida.horario ?? null,
      descripcion: comida.descripcion ?? null,
      items: comida.items.map((item) => {
        const alimento = item.food_id
          ? alimentos.get(item.food_id)
          : undefined;
        if (!alimento) {
          return {
            food_id: null,
            food: null,
            descripcion_libre: item.descripcion_libre ?? null,
            cantidad_porciones: item.cantidad_porciones,
            energia_kcal: item.energia_kcal ?? 0,
            proteina_g: item.proteina_g ?? 0,
            carbohidratos_g: item.carbohidratos_g ?? 0,
            lipidos_g: item.lipidos_g ?? 0,
          };
        }

        return {
          food_id: alimento.id,
          food: {
            id: alimento.id,
            nombre: alimento.nombre,
            grupo: alimento.grupoSmae,
            porcion_descripcion: alimento.porcionDescripcion,
            porcion_gramos: alimento.porcionGramos,
            imagen_url: alimento.imagenUrl,
          },
          descripcion_libre: item.descripcion_libre ?? null,
          cantidad_porciones: item.cantidad_porciones,
          energia_kcal: escalar(
            alimento.energiaKcal,
            item.cantidad_porciones,
          ),
          proteina_g: escalar(alimento.proteinaG, item.cantidad_porciones),
          carbohidratos_g: escalar(
            alimento.carbohidratosG,
            item.cantidad_porciones,
          ),
          lipidos_g: escalar(alimento.lipidosG, item.cantidad_porciones),
        };
      }),
    })),
  };
}
