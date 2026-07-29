import {
  type IdentificadoresPaciente,
  etiquetaObjetivo,
  objetivoDesdeDb,
  seudonimizarOpcional,
  seudonimizarTexto,
} from '@nutria/shared';

import { prisma } from '@/server/db';
import { esIdValido } from '@/server/patients/ownership';

/**
 * Contexto que se le manda al modelo cuando quien pregunta es el **paciente**.
 *
 * Es deliberadamente más pobre que `ContextoPaciente` (el del panel): allí el
 * lector es un profesional que necesita la ficha clínica completa; aquí la
 * salida la lee el paciente y el prompt no tiene por qué llevar antecedentes,
 * medicamentos ni condiciones. §8.3 del plan lo pide así.
 *
 * Lo que sí viaja, y por qué:
 *
 * | Dato | Motivo |
 * |---|---|
 * | Objetivo | Sin él, el coach orienta a ciegas |
 * | Metas del plan vigente | Es contra lo que se comparan las porciones |
 * | Alergias | Restricción absoluta: una sustitución sin ellas puede dañar |
 * | Tipo de dieta y disgustos | Evita proponer algo que no va a comer |
 *
 * Y lo que **no** viaja: nombre, correo, teléfono, antecedentes, medicamentos,
 * condiciones y notas del nutriólogo.
 */

export type MetasDelPlan = {
  calorias: number;
  proteinaG: number;
  carbosG: number;
  grasaG: number;
};

export type ContextoCoach = {
  patientId: string;
  objetivo: string;
  /** `null` cuando no hay plan activo y compartido (§5.4): no se inventan metas. */
  metas: MetasDelPlan | null;
  alergias: string[];
  tipoDieta: string | null;
  disgustos: string | null;
  comidasPorDia: number;
  /**
   * Identificadores del propio paciente. **No se envían**: sirven para limpiar
   * el texto libre que él escribe, que casi siempre incluye su nombre.
   */
  identificadores: IdentificadoresPaciente;
};

function textosDe(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((elemento): elemento is string => typeof elemento === 'string')
    .map((elemento) => elemento.trim())
    .filter(Boolean);
}

/**
 * Carga el contexto del paciente ya seudonimizado.
 *
 * El `patientId` viene de `requierePaciente`, no de la petición, así que aquí no
 * hay nada que autorizar: basta con confirmar que el expediente sigue vivo.
 */
export async function cargarContextoCoach(patientId: string): Promise<ContextoCoach | null> {
  if (!esIdValido(patientId)) return null;

  const paciente = await prisma.patient.findFirst({
    where: { id: patientId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      email: true,
      telefono: true,
      medicalRecord: { select: { objetivo: true, objetivoOtro: true } },
      foodPreference: {
        select: { alergias: true, tipoDieta: true, disgustos: true, comidasPorDia: true },
      },
    },
  });
  if (!paciente) return null;

  const identificadores: IdentificadoresPaciente = {
    nombre: paciente.nombre,
    email: paciente.email,
    telefono: paciente.telefono,
  };
  const medico = paciente.medicalRecord;
  const preferencias = paciente.foodPreference;

  return {
    patientId: paciente.id,
    // Todo campo capturable a mano pasa por el filtro, no solo los obvios: el
    // objetivo "Otro", el tipo de dieta y las alergias son texto libre y pueden
    // mencionar a una persona.
    objetivo: medico
      ? seudonimizarTexto(
          etiquetaObjetivo(objetivoDesdeDb(medico.objetivo), medico.objetivoOtro),
          identificadores,
        )
      : 'sin registrar',
    metas: await metasDelPlanVigente(patientId),
    alergias: textosDe(preferencias?.alergias).map((alergia) =>
      seudonimizarTexto(alergia, identificadores),
    ),
    tipoDieta: seudonimizarOpcional(preferencias?.tipoDieta, identificadores),
    disgustos: seudonimizarOpcional(preferencias?.disgustos, identificadores),
    comidasPorDia: preferencias?.comidasPorDia ?? 3,
    identificadores,
  };
}

/**
 * Metas del plan que el paciente sí puede ver: activo **y** compartido, el mismo
 * filtro que `me/repository.planVigente`. Un borrador todavía no rige para él, y
 * el coach no debe orientarlo contra metas que su nutrióloga aún no aprobó.
 */
async function metasDelPlanVigente(patientId: string): Promise<MetasDelPlan | null> {
  const plan = await prisma.mealPlan.findFirst({
    where: { patientId, estado: 'ACTIVO', compartidoAt: { not: null } },
    orderBy: { activadoAt: 'desc' },
    select: { caloriasDiarias: true, proteinaG: true, carbosG: true, grasaG: true },
  });
  if (!plan) return null;

  return {
    calorias: plan.caloriasDiarias,
    proteinaG: plan.proteinaG,
    carbosG: plan.carbosG,
    grasaG: plan.grasaG,
  };
}

/** Limpia el texto libre que escribe el paciente antes de meterlo al prompt. */
export function limpiarTextoDelPaciente(texto: string, contexto: ContextoCoach): string {
  return seudonimizarTexto(texto, contexto.identificadores);
}

/**
 * Receta que el paciente puede usar como contexto de una sustitución.
 *
 * Filtrada por `patientId` **y** por `estado = ENVIADA`: pedir una sustitución
 * sobre una receta ajena, o sobre un borrador que su nutrióloga no le mandó,
 * sería una fuga por la puerta de atrás.
 */
export type RecetaParaSustitucion = { nombre: string; ingredientes: string[] };

export async function recetaEnviadaDelPaciente(
  patientId: string,
  recetaId: string,
): Promise<RecetaParaSustitucion | null> {
  if (!esIdValido(recetaId)) return null;

  const receta = await prisma.recipe.findFirst({
    where: { id: recetaId, patientId, estado: 'ENVIADA' },
    select: { nombre: true, ingredientes: true },
  });
  if (!receta) return null;

  return { nombre: receta.nombre, ingredientes: textosDe(receta.ingredientes) };
}
