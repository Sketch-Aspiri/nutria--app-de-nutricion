import type {
  ActivityPlan,
  Appointment,
  ExerciseLog,
  MealLog,
  Message,
  Recipe,
  WaterLog,
  WeightLog,
} from '@prisma/client';

import {
  calcularAdherencia,
  calcularLogros,
  DIAS_VENTANA_ADHERENCIA,
  fechaIsoEnZona,
  type FechaIso,
  type Logro,
  type ResumenAdherencia,
  tendenciaPeso,
} from '@nutria/shared';

import { prisma } from '@/server/db';
import { esIdValido } from '@/server/patients/ownership';
import { planDetalleInclude, type PlanConDetalle } from '@/server/plans/serializers';

import type {
  FiltroFechasInput,
  GuardarAguaInput,
  RegistrarComidaInput,
  RegistrarEjercicioInput,
  RegistrarPesoInput,
} from './schemas';

/**
 * Acceso a datos de la app del paciente.
 *
 * Diferencia esencial con `@/server/patients/repository`: allí el ancla de
 * autorización es el `nutritionistId` y el `patientId` viene de la ruta; aquí
 * el `patientId` **ya viene resuelto por `requierePaciente`** desde la sesión y
 * es el único filtro que hace falta. Por eso son dos repositorios y no uno con
 * un parámetro más: mezclarlos haría fácil olvidar cuál de los dos filtros
 * aplica cada consulta.
 *
 * La otra regla de este módulo: el paciente solo ve lo que su nutriólogo
 * aprobó. Todo lo que se lee se filtra por `compartido_at` o por `estado`,
 * nunca por "existe".
 */

/** Un día `YYYY-MM-DD` se guarda como medianoche UTC en una columna `@db.Date`. */
function aColumnaFecha(dia: FechaIso): Date {
  return new Date(`${dia}T00:00:00Z`);
}

function soloFecha(fecha: Date): FechaIso {
  return fecha.toISOString().slice(0, 10);
}

function rangoDeFiltros(filtros: FiltroFechasInput) {
  if (!filtros.desde && !filtros.hasta) return {};
  return {
    fecha: {
      ...(filtros.desde ? { gte: aColumnaFecha(filtros.desde) } : {}),
      ...(filtros.hasta ? { lte: aColumnaFecha(filtros.hasta) } : {}),
    },
  };
}

/**
 * Zona horaria del consultorio que atiende al paciente.
 *
 * El día natural del paciente es el mismo que usa el panel para medir su
 * adherencia: si divergieran, paciente y nutriólogo verían rachas distintas
 * sobre los mismos registros.
 */
export async function zonaHorariaDelPaciente(patientId: string): Promise<string> {
  const paciente = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { nutritionist: { select: { nutritionistProfile: { select: { zonaHoraria: true } } } } },
  });
  return paciente?.nutritionist.nutritionistProfile?.zonaHoraria ?? 'America/Mexico_City';
}

// --- Perfil ------------------------------------------------------------------

export type PerfilPaciente = {
  id: string;
  nombre: string;
  email: string | null;
  fotoUrl: string | null;
  objetivo: string | null;
  objetivoOtro: string | null;
  nutriologo: { nombre: string | null; consultorio: string | null };
  metaAguaVasos: number;
  metas: {
    caloriasDiarias: number;
    proteinaG: number;
    carbosG: number;
    grasaG: number;
  } | null;
};

export async function perfilDe(patientId: string): Promise<PerfilPaciente | null> {
  const paciente = await prisma.patient.findFirst({
    where: { id: patientId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      email: true,
      fotoUrl: true,
      medicalRecord: { select: { objetivo: true, objetivoOtro: true } },
      foodPreference: { select: { metaAguaVasos: true } },
      nutritionist: {
        select: {
          name: true,
          nutritionistProfile: { select: { nombreCompleto: true } },
        },
      },
    },
  });
  if (!paciente) return null;

  // Las metas salen del plan vigente, no de columnas propias (§5.4): sin plan
  // compartido la app muestra un estado vacío, no ceros.
  const plan = await planVigente(patientId);

  return {
    id: paciente.id,
    nombre: paciente.nombre,
    email: paciente.email,
    fotoUrl: paciente.fotoUrl,
    objetivo: paciente.medicalRecord?.objetivo ?? null,
    objetivoOtro: paciente.medicalRecord?.objetivoOtro ?? null,
    nutriologo: {
      nombre: paciente.nutritionist.nutritionistProfile?.nombreCompleto ?? paciente.nutritionist.name,
      consultorio: paciente.nutritionist.name,
    },
    metaAguaVasos: paciente.foodPreference?.metaAguaVasos ?? 8,
    metas: plan
      ? {
          caloriasDiarias: plan.caloriasDiarias,
          proteinaG: plan.proteinaG,
          carbosG: plan.carbosG,
          grasaG: plan.grasaG,
        }
      : null,
  };
}

// --- Plan, recetas y actividad ----------------------------------------------

/**
 * Plan que el paciente puede ver: activo **y** compartido.
 *
 * Las dos condiciones son necesarias. Un borrador activo todavía no está
 * aprobado para él, y un plan compartido pero archivado ya no rige.
 */
export async function planVigente(patientId: string): Promise<PlanConDetalle | null> {
  return prisma.mealPlan.findFirst({
    where: { patientId, estado: 'ACTIVO', compartidoAt: { not: null } },
    orderBy: { activadoAt: 'desc' },
    include: planDetalleInclude,
  });
}

/** Solo las recetas que el nutriólogo envió; las sugeridas son su borrador. */
export function recetasEnviadas(patientId: string): Promise<Recipe[]> {
  return prisma.recipe.findMany({
    where: { patientId, estado: 'ENVIADA' },
    orderBy: { updatedAt: 'desc' },
  });
}

export function planActividadCompartido(patientId: string): Promise<ActivityPlan | null> {
  return prisma.activityPlan.findFirst({
    where: { patientId, compartidoAt: { not: null } },
    orderBy: { compartidoAt: 'desc' },
  });
}

// --- Registros de comida -----------------------------------------------------

export type ComidaRegistrada = { comida: MealLog; zonaHoraria: string };

/**
 * Marca una comida del plan o registra una libre.
 *
 * Si viene `meal_plan_meal_id`, se comprueba que esa comida pertenezca a un
 * plan **de este paciente**: sin la comprobación, un id ajeno colgaría el
 * registro del plan de otra persona.
 */
export async function registrarComida(
  patientId: string,
  datos: RegistrarComidaInput,
): Promise<ComidaRegistrada | null> {
  if (datos.meal_plan_meal_id) {
    const comidaDelPlan = await prisma.mealPlanMeal.findFirst({
      where: { id: datos.meal_plan_meal_id, mealPlan: { patientId } },
      select: { id: true },
    });
    if (!comidaDelPlan) return null;
  }

  const instante = datos.fecha ? new Date(datos.fecha) : new Date();
  const [comida, zonaHoraria] = await Promise.all([
    prisma.mealLog.create({
      data: {
        patientId,
        mealPlanMealId: datos.meal_plan_meal_id ?? null,
        fecha: instante,
        hora: instante,
        nombre: datos.nombre,
        calorias: datos.calorias ?? null,
        proteinaG: datos.proteina_g ?? null,
        carbosG: datos.carbos_g ?? null,
        grasaG: datos.grasa_g ?? null,
        origen: datos.origen,
        fotoUrl: datos.foto_url ?? null,
        comentarioPaciente: datos.comentario_paciente ?? null,
      },
    }),
    zonaHorariaDelPaciente(patientId),
  ]);

  return { comida, zonaHoraria };
}

/** Desmarcar. El filtro por `patientId` va en el `where`, no en una lectura previa. */
export async function borrarComida(patientId: string, comidaId: string): Promise<boolean> {
  if (!esIdValido(comidaId)) return false;

  const { count } = await prisma.mealLog.deleteMany({ where: { id: comidaId, patientId } });
  return count > 0;
}

// --- Peso, ejercicio y agua --------------------------------------------------

export function listarPesos(
  patientId: string,
  filtros: FiltroFechasInput,
): Promise<WeightLog[]> {
  return prisma.weightLog.findMany({
    where: { patientId, ...rangoDeFiltros(filtros) },
    orderBy: { fecha: 'asc' },
  });
}

/** Un peso por día: volver a pesarse corrige la lectura, no duplica el punto. */
export function registrarPeso(
  patientId: string,
  datos: RegistrarPesoInput,
): Promise<WeightLog> {
  const fecha = aColumnaFecha(datos.fecha);
  return prisma.weightLog.upsert({
    where: { patientId_fecha: { patientId, fecha } },
    create: { patientId, fecha, pesoKg: datos.peso_kg },
    update: { pesoKg: datos.peso_kg },
  });
}

export function listarEjercicio(
  patientId: string,
  filtros: FiltroFechasInput,
): Promise<ExerciseLog[]> {
  return prisma.exerciseLog.findMany({
    where: { patientId, ...rangoDeFiltros(filtros) },
    orderBy: { fecha: 'desc' },
  });
}

export function registrarEjercicio(
  patientId: string,
  datos: RegistrarEjercicioInput,
): Promise<ExerciseLog> {
  return prisma.exerciseLog.create({
    data: {
      patientId,
      fecha: aColumnaFecha(datos.fecha),
      tipo: datos.tipo,
      duracionMin: datos.duracion_min,
    },
  });
}

/**
 * Vasos del día, idempotente: la app manda el total, no un incremento.
 *
 * Un `+1` se perdería o se duplicaría con reintentos de red; el total absoluto
 * converge al mismo valor sin importar cuántas veces llegue.
 */
export function guardarAgua(patientId: string, datos: GuardarAguaInput): Promise<WaterLog> {
  const fecha = aColumnaFecha(datos.fecha);
  return prisma.waterLog.upsert({
    where: { patientId_fecha: { patientId, fecha } },
    create: { patientId, fecha, vasos: datos.vasos },
    update: { vasos: datos.vasos },
  });
}

// --- Pantalla "Hoy" ----------------------------------------------------------

export type ResumenHoy = {
  dia: FechaIso;
  zonaHoraria: string;
  plan: PlanConDetalle | null;
  /** Ids de `meal_plan_meals` ya marcadas hoy. */
  comidasMarcadas: string[];
  registros: MealLog[];
  agua: { vasos: number; meta: number };
  adherencia: ResumenAdherencia | null;
};

/**
 * Todo lo que pinta la pantalla Hoy en una sola llamada.
 *
 * Se resuelve en el servidor para que la app no tenga que orquestar cinco
 * peticiones ni recalcular adherencia con datos parciales.
 */
export async function resumenDeHoy(patientId: string): Promise<ResumenHoy> {
  const zonaHoraria = await zonaHorariaDelPaciente(patientId);
  const dia = fechaIsoEnZona(new Date(), zonaHoraria);
  const plan = await planVigente(patientId);

  const desdeVentana = new Date(Date.now() - DIAS_VENTANA_ADHERENCIA * 86_400_000);
  const [registrosVentana, agua, preferencias] = await Promise.all([
    prisma.mealLog.findMany({
      where: { patientId, fecha: { gte: desdeVentana } },
      orderBy: { fecha: 'asc' },
    }),
    prisma.waterLog.findUnique({
      where: { patientId_fecha: { patientId, fecha: aColumnaFecha(dia) } },
      select: { vasos: true },
    }),
    prisma.foodPreference.findUnique({
      where: { patientId },
      select: { metaAguaVasos: true },
    }),
  ]);

  const registrosDeHoy = registrosVentana.filter(
    (registro) => fechaIsoEnZona(registro.fecha, zonaHoraria) === dia,
  );

  const comidasPorDia = plan?.meals.length ?? 0;
  const adherencia =
    plan && comidasPorDia > 0
      ? calcularAdherencia({
          registros: registrosVentana.map((registro) => ({
            fecha: fechaIsoEnZona(registro.fecha, zonaHoraria),
          })),
          comidasPorDia,
          planActivoDesde: fechaIsoEnZona(plan.activadoAt ?? plan.createdAt, zonaHoraria),
          hoy: dia,
        })
      : null;

  return {
    dia,
    zonaHoraria,
    plan,
    comidasMarcadas: registrosDeHoy
      .map((registro) => registro.mealPlanMealId)
      .filter((id): id is string => id !== null),
    registros: registrosDeHoy,
    agua: { vasos: agua?.vasos ?? 0, meta: preferencias?.metaAguaVasos ?? 8 },
    adherencia,
  };
}

// --- Progreso ----------------------------------------------------------------

export type ResumenProgreso = {
  pesos: WeightLog[];
  peso: { inicial: number; actual: number; cambioKg: number } | null;
  /**
   * Kilos que faltan para la meta. Siempre `null` en V1: el modelo no guarda un
   * peso objetivo, y estimarlo sería inventarle una meta clínica al paciente.
   */
  faltaKg: null;
  logros: Logro[];
};

export async function resumenDeProgreso(patientId: string): Promise<ResumenProgreso> {
  const zonaHoraria = await zonaHorariaDelPaciente(patientId);
  const hoy = fechaIsoEnZona(new Date(), zonaHoraria);

  const [pesos, comidas, aguas, ejercicios, preferencias] = await Promise.all([
    prisma.weightLog.findMany({ where: { patientId }, orderBy: { fecha: 'asc' } }),
    prisma.mealLog.findMany({ where: { patientId }, select: { fecha: true } }),
    prisma.waterLog.findMany({ where: { patientId }, select: { fecha: true, vasos: true } }),
    prisma.exerciseLog.findMany({ where: { patientId }, select: { fecha: true } }),
    prisma.foodPreference.findUnique({
      where: { patientId },
      select: { metaAguaVasos: true },
    }),
  ]);

  const metaAgua = preferencias?.metaAguaVasos ?? 8;
  const peso = tendenciaPeso(
    pesos.map((registro) => ({ fecha: soloFecha(registro.fecha), pesoKg: registro.pesoKg })),
  );

  return {
    pesos,
    peso,
    faltaKg: null,
    logros: calcularLogros({
      diasConRegistro: comidas.map((comida) => fechaIsoEnZona(comida.fecha, zonaHoraria)),
      diasConMetaAgua: aguas
        .filter((registro) => registro.vasos >= metaAgua)
        .map((registro) => soloFecha(registro.fecha)),
      diasConEjercicio: ejercicios.map((registro) => soloFecha(registro.fecha)),
      pesoInicial: peso?.inicial ?? null,
      pesoActual: peso?.actual ?? null,
      pesoMeta: null,
      hoy,
    }),
  };
}

// --- Mensajes ----------------------------------------------------------------

export function listarMensajes(patientId: string, take: number): Promise<Message[]> {
  return prisma.message.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

/**
 * El paciente escribe en el mismo hilo que lee el nutriólogo.
 *
 * El `nutritionistId` se toma del expediente, no del cliente: es el único
 * destinatario posible y aceptarlo por parámetro permitiría escribirle a
 * cualquier profesional de la plataforma.
 */
export async function enviarMensaje(patientId: string, texto: string): Promise<Message | null> {
  const paciente = await prisma.patient.findFirst({
    where: { id: patientId, deletedAt: null },
    select: { nutritionistId: true },
  });
  if (!paciente) return null;

  return prisma.message.create({
    data: {
      patientId,
      nutritionistId: paciente.nutritionistId,
      emisor: 'PATIENT',
      texto,
    },
  });
}

/** Marca como leídos los mensajes que le escribió el nutriólogo, no los propios. */
export async function marcarMensajesLeidos(patientId: string): Promise<number> {
  const { count } = await prisma.message.updateMany({
    where: { patientId, emisor: 'NUTRITIONIST', leidoAt: null },
    data: { leidoAt: new Date() },
  });
  return count;
}

export function contarMensajesSinLeer(patientId: string): Promise<number> {
  return prisma.message.count({
    where: { patientId, emisor: 'NUTRITIONIST', leidoAt: null },
  });
}

// --- Citas -------------------------------------------------------------------

/** Solo lectura en V1: el paciente no agenda ni cancela desde la app. */
export function proximasCitas(patientId: string, take: number): Promise<Appointment[]> {
  return prisma.appointment.findMany({
    where: { patientId, estado: 'PROGRAMADA', inicio: { gte: new Date() } },
    orderBy: { inicio: 'asc' },
    take,
  });
}
