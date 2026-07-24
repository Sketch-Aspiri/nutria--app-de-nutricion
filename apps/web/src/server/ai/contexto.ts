import { type Food, Prisma } from '@prisma/client';

import {
  type SnapshotCalculo,
  edadDesdeFechaNacimiento,
  etiquetaObjetivo,
  generoDesdeDb,
  nivelActividadDesdeDb,
  objetivoDesdeDb,
  seudonimizarOpcional,
  seudonimizarTexto,
} from '@nutria/shared';

import { prisma } from '@/server/db';
import { esIdValido } from '@/server/patients/repository';

import { MAX_ALIMENTOS_EN_PROMPT } from './config';

/**
 * Arma el contexto clínico que se le manda al modelo, ya seudonimizado.
 *
 * Esta es la única frontera por la que salen datos del expediente, así que la
 * seudonimización se aplica aquí y no en cada prompt: quien agregue un caso de
 * uso nuevo obtiene el contexto ya limpio sin tener que acordarse.
 */

export type MetaEnergetica = {
  calorias: number;
  proteinaG: number;
  carbosG: number;
  grasaG: number;
  ecuacion: string;
};

export type ContextoPaciente = {
  patientId: string;
  edad: number | null;
  genero: string;
  nivelActividad: string;
  objetivo: string;
  condiciones: string[];
  antecedentes: string | null;
  medicamentos: string | null;
  tipoDieta: string | null;
  alergias: string[];
  disgustos: string | null;
  comidasPorDia: number;
  pesoKg: number | null;
  alturaCm: number | null;
  meta: MetaEnergetica | null;
};

function textosDe(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((elemento): elemento is string => typeof elemento === 'string')
    .map((elemento) => elemento.trim())
    .filter(Boolean);
}

/**
 * Lee la meta del último plan con snapshot. El snapshot es JSON libre en la BD,
 * así que se comprueba la forma antes de confiar en él: un snapshot viejo o
 * corrupto debe traducirse en "sin meta", no en un prompt con `undefined`.
 */
function metaDesdeSnapshot(snapshot: unknown): MetaEnergetica | null {
  if (typeof snapshot !== 'object' || snapshot === null) return null;
  const { resultado } = snapshot as Partial<SnapshotCalculo>;
  if (!resultado) return null;

  const { objetivoCalorias, proteina_g, carbos_g, grasa_g, ecuacion } = resultado;
  if (
    typeof objetivoCalorias !== 'number' ||
    typeof proteina_g !== 'number' ||
    typeof carbos_g !== 'number' ||
    typeof grasa_g !== 'number'
  ) {
    return null;
  }

  return {
    calorias: Math.round(objetivoCalorias),
    proteinaG: Math.round(proteina_g),
    carbosG: Math.round(carbos_g),
    grasaG: Math.round(grasa_g),
    ecuacion: typeof ecuacion === 'string' ? ecuacion : 'no registrada',
  };
}

/**
 * Carga el contexto del paciente filtrando por `nutritionistId` dentro de la
 * misma consulta, igual que el resto de `src/server`: nunca se lee primero y se
 * compara después. Devuelve `null` si el paciente no es de este nutriólogo.
 */
export async function cargarContextoPaciente(
  nutritionistId: string,
  patientId: string,
): Promise<ContextoPaciente | null> {
  if (!esIdValido(patientId)) return null;

  const paciente = await prisma.patient.findFirst({
    where: { id: patientId, nutritionistId, deletedAt: null },
    include: {
      medicalRecord: true,
      foodPreference: true,
      measurements: { orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }], take: 1 },
      mealPlans: {
        where: { calculoSnapshot: { not: Prisma.DbNull } },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!paciente) return null;

  const identificadores = {
    nombre: paciente.nombre,
    email: paciente.email,
    telefono: paciente.telefono,
  };
  const medico = paciente.medicalRecord;
  const preferencias = paciente.foodPreference;
  const medicion = paciente.measurements.at(0);

  return {
    patientId: paciente.id,
    // `edadDesdeFechaNacimiento` devuelve 0 cuando falta la fecha, para que las
    // fórmulas fallen con EXPEDIENTE_INCOMPLETO. Aquí ese 0 se traduce a null:
    // decirle al modelo "0 años" sería peor que decirle que no se registró.
    edad: edadDesdeFechaNacimiento(paciente.fechaNacimiento) || null,
    genero: generoDesdeDb(paciente.genero),
    nivelActividad: medico ? nivelActividadDesdeDb(medico.nivelActividad) : 'sin registrar',
    // Todo campo que admita texto libre pasa por el filtro, no solo los
    // obvios: el objetivo "Otro", el tipo de dieta y las condiciones también
    // son capturables a mano y pueden mencionar a una persona.
    objetivo: medico
      ? seudonimizarTexto(
          etiquetaObjetivo(objetivoDesdeDb(medico.objetivo), medico.objetivoOtro),
          identificadores,
        )
      : 'sin registrar',
    condiciones: textosDe(medico?.condiciones).map((condicion) =>
      seudonimizarTexto(condicion, identificadores),
    ),
    antecedentes: seudonimizarOpcional(medico?.antecedentes, identificadores),
    medicamentos: seudonimizarOpcional(medico?.medicamentos, identificadores),
    tipoDieta: seudonimizarOpcional(preferencias?.tipoDieta, identificadores),
    alergias: textosDe(preferencias?.alergias).map((alergia) =>
      seudonimizarTexto(alergia, identificadores),
    ),
    disgustos: seudonimizarOpcional(preferencias?.disgustos, identificadores),
    comidasPorDia: preferencias?.comidasPorDia ?? 3,
    pesoKg: medicion?.pesoKg ?? null,
    alturaCm: medicion?.alturaCm ?? null,
    meta: metaDesdeSnapshot(paciente.mealPlans.at(0)?.calculoSnapshot),
  };
}

/**
 * Devuelve los identificadores del paciente para poder limpiar el texto libre
 * que el nutriólogo escribe (una nota dictada suele incluir el nombre).
 */
export async function identificadoresDePaciente(
  nutritionistId: string,
  patientId: string,
): Promise<{ nombre: string | null; email: string | null; telefono: string | null } | null> {
  if (!esIdValido(patientId)) return null;
  const paciente = await prisma.patient.findFirst({
    where: { id: patientId, nutritionistId, deletedAt: null },
    select: { nombre: true, email: true, telefono: true },
  });
  return paciente ?? null;
}

export type AlimentoCatalogo = {
  id: string;
  nombre: string;
  grupo: string;
  /** Texto que ve el modelo, ej. "1 pieza mediana (120 g)". */
  porcion: string;
  porcionDescripcion: string;
  porcionGramos: number;
  imagenUrl: string | null;
  energiaKcal: number;
  proteinaG: number;
  carbosG: number;
  lipidosG: number;
};

function aCatalogo(alimento: Food): AlimentoCatalogo {
  return {
    id: alimento.id,
    nombre: alimento.nombre,
    grupo: alimento.grupoSmae,
    porcion: `${alimento.porcionDescripcion} (${alimento.porcionGramos} g)`,
    porcionDescripcion: alimento.porcionDescripcion,
    porcionGramos: alimento.porcionGramos,
    imagenUrl: alimento.imagenUrl,
    energiaKcal: Math.round(alimento.energiaKcal),
    proteinaG: Math.round(alimento.proteinaG),
    carbosG: Math.round(alimento.carbohidratosG),
    lipidosG: Math.round(alimento.lipidosG),
  };
}

/**
 * Catálogo que se le ofrece al modelo para que ancle el plan a alimentos reales.
 *
 * Se acota a `MAX_ALIMENTOS_EN_PROMPT` y se reparte entre los grupos SMAE: un
 * volcado completo de la base no cabe en el prompt y, aunque cupiera, sesgaría
 * el plan hacia el grupo que más filas tenga.
 */
export async function cargarCatalogoAlimentos(
  nutritionistId: string,
  limite = MAX_ALIMENTOS_EN_PROMPT,
): Promise<AlimentoCatalogo[]> {
  const grupos = await prisma.food.groupBy({
    by: ['grupoSmae'],
    where: {
      deletedAt: null,
      OR: [{ esPublico: true, nutritionistId: null }, { nutritionistId }],
    },
  });
  if (grupos.length === 0) return [];

  const porGrupo = Math.max(Math.floor(limite / grupos.length), 1);
  const lotes = await Promise.all(
    grupos.map((grupo) =>
      prisma.food.findMany({
        where: {
          deletedAt: null,
          grupoSmae: grupo.grupoSmae,
          OR: [{ esPublico: true, nutritionistId: null }, { nutritionistId }],
        },
        // Los propios del nutriólogo primero: son los que más usa.
        orderBy: [{ nutritionistId: { sort: 'desc', nulls: 'last' } }, { nombre: 'asc' }],
        take: porGrupo,
      }),
    ),
  );

  return lotes.flat().slice(0, limite).map(aCatalogo);
}

/** Limpia el texto libre que escribe el nutriólogo antes de meterlo al prompt. */
export function limpiarTextoDelNutriologo(
  texto: string,
  identificadores: { nombre?: string | null; email?: string | null; telefono?: string | null },
): string {
  return seudonimizarTexto(texto, identificadores);
}
