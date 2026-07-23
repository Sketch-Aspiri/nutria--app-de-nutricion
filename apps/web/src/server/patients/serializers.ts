import type {
  AnthropometryMeasurement,
  FoodPreference,
  MedicalRecord,
  Patient,
} from '@prisma/client';

import { edadDesdeFechaNacimiento } from '@nutria/shared';

/**
 * Conversión de filas de Prisma al JSON público de `/api/v1`.
 * Campos en snake_case y fechas ISO 8601, según `rules/api-conventions.md`.
 */

/** Las columnas Json llegan como `unknown`: se filtra a strings para no romper la UI. */
function comoListaDeTexto(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is string => typeof item === 'string');
}

function soloFecha(fecha: Date | null): string | null {
  return fecha ? fecha.toISOString().slice(0, 10) : null;
}

export type MedicionSerializada = ReturnType<typeof serializarMedicion>;

export function serializarMedicion(medicion: AnthropometryMeasurement) {
  return {
    id: medicion.id,
    fecha: soloFecha(medicion.fecha),
    peso_kg: medicion.pesoKg,
    altura_cm: medicion.alturaCm,
    cintura_cm: medicion.cinturaCm,
    cadera_cm: medicion.caderaCm,
    grasa_pct: medicion.grasaPct,
    musculo_pct: medicion.musculoPct,
    pliegues: medicion.pliegues ?? null,
    created_at: medicion.createdAt.toISOString(),
  };
}

export function serializarExpedienteMedico(expediente: MedicalRecord | null) {
  if (!expediente) return null;
  return {
    condiciones: comoListaDeTexto(expediente.condiciones),
    antecedentes: expediente.antecedentes,
    medicamentos: expediente.medicamentos,
    nivel_actividad: expediente.nivelActividad,
    objetivo: expediente.objetivo,
  };
}

export function serializarPreferencias(preferencias: FoodPreference | null) {
  if (!preferencias) return null;
  return {
    tipo_dieta: preferencias.tipoDieta,
    alergias: comoListaDeTexto(preferencias.alergias),
    disgustos: preferencias.disgustos,
    comidas_por_dia: preferencias.comidasPorDia,
    presupuesto_tiempo: preferencias.presupuestoTiempo,
  };
}

type PacienteConRelaciones = Patient & {
  medicalRecord: MedicalRecord | null;
  foodPreference: FoodPreference | null;
  measurements: AnthropometryMeasurement[];
};

function datosBase(paciente: Patient) {
  return {
    id: paciente.id,
    nombre: paciente.nombre,
    fecha_nacimiento: soloFecha(paciente.fechaNacimiento),
    // Se envía calculada para que la UI no repita la aritmética de fechas.
    edad: edadDesdeFechaNacimiento(paciente.fechaNacimiento),
    genero: paciente.genero,
    email: paciente.email,
    telefono: paciente.telefono,
    foto_url: paciente.fotoUrl,
    estado: paciente.estado,
    created_at: paciente.createdAt.toISOString(),
    updated_at: paciente.updatedAt.toISOString(),
  };
}

/** Fila del listado: sin expediente completo ni histórico de mediciones. */
export function serializarPacienteResumen(
  paciente: Patient & { medicalRecord: MedicalRecord | null },
) {
  return {
    ...datosBase(paciente),
    objetivo: paciente.medicalRecord?.objetivo ?? null,
  };
}

export function serializarPacienteDetalle(paciente: PacienteConRelaciones) {
  const mediciones = paciente.measurements;
  return {
    ...datosBase(paciente),
    expediente_medico: serializarExpedienteMedico(paciente.medicalRecord),
    preferencias_alimentarias: serializarPreferencias(paciente.foodPreference),
    // Vienen ordenadas de la más reciente a la más antigua.
    mediciones: mediciones.map(serializarMedicion),
    ultima_medicion: mediciones[0] ? serializarMedicion(mediciones[0]) : null,
  };
}
