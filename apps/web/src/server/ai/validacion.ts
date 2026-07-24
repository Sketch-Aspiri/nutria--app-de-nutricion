import { tieneConflictoAlergia } from '@nutria/shared';

import { TOLERANCIA_ENERGIA } from './config';
import type { AlimentoCatalogo, ContextoPaciente } from './contexto';
import type { PlanBorrador, RecetaBorrador } from './schemas';

/**
 * Validación clínica de la salida de la IA, después de Zod.
 *
 * Zod garantiza la forma; esto garantiza que el contenido sea usable: que los
 * alimentos existan de verdad, que no aparezca un alérgeno y que la energía no
 * se aleje de la meta. Un borrador que no pasa se reintenta una vez y, si vuelve
 * a fallar, se degrada a texto editable en lugar de mostrarse como si fuera bueno.
 */

export type ResultadoValidacion = { ok: true } | { ok: false; motivos: string[] };

function resultado(motivos: string[]): ResultadoValidacion {
  return motivos.length === 0 ? { ok: true } : { ok: false, motivos };
}

/** Texto sobre el que se buscan alérgenos en un borrador de plan. */
function textoDelPlan(plan: PlanBorrador): string {
  return plan.comidas
    .flatMap((comida) => [
      comida.nombre,
      comida.descripcion,
      ...comida.items.map((item) => item.descripcion),
    ])
    .join(' ');
}

function alergenosEn(texto: string, alergias: string[]): string[] {
  return alergias.filter((alergia) => tieneConflictoAlergia(texto, [alergia]));
}

export function validarPlan(
  plan: PlanBorrador,
  contexto: ContextoPaciente,
  alimentos: AlimentoCatalogo[],
): ResultadoValidacion {
  const motivos: string[] = [];

  // 1. Los food_id tienen que existir en el catálogo que se le ofreció al
  //    modelo. Un identificador inventado reventaría al guardar el plan.
  const conocidos = new Set(alimentos.map((alimento) => alimento.id));
  const nombrePorId = new Map(alimentos.map((alimento) => [alimento.id, alimento.nombre]));
  const inventados = plan.comidas
    .flatMap((comida) => comida.items)
    .map((item) => item.food_id)
    .filter((id): id is string => id !== null && !conocidos.has(id));
  if (inventados.length > 0) {
    motivos.push(
      `Los identificadores de alimento ${inventados.join(', ')} no existen en el catálogo. Usa solo los de la lista o pon food_id en null.`,
    );
  }

  // 2. Alérgenos: se revisa el texto del plan y, además, el nombre real de cada
  //    alimento referenciado — el modelo puede describir "queso panela" como
  //    "guarnición" y el alérgeno solo aparecer en el catálogo.
  const nombresReferenciados = plan.comidas
    .flatMap((comida) => comida.items)
    .map((item) => (item.food_id ? nombrePorId.get(item.food_id) : null))
    .filter((nombre): nombre is string => Boolean(nombre));
  const alergenos = alergenosEn(
    [textoDelPlan(plan), ...nombresReferenciados].join(' '),
    contexto.alergias,
  );
  if (alergenos.length > 0) {
    motivos.push(
      `El borrador menciona alérgenos declarados por el paciente: ${alergenos.join(', ')}. Sustitúyelos por alimentos equivalentes.`,
    );
  }

  // 3. Energía dentro de ±5% de la meta calculada (sección 8 del plan V2).
  if (contexto.meta) {
    const { calorias } = contexto.meta;
    const desviacion = Math.abs(plan.calorias_diarias - calorias) / calorias;
    if (desviacion > TOLERANCIA_ENERGIA) {
      motivos.push(
        `El total de ${plan.calorias_diarias} kcal se desvía ${Math.round(desviacion * 100)}% de la meta de ${calorias} kcal. Ajústalo al rango permitido.`,
      );
    }
  }

  // 4. Número de tiempos de comida: es lo que el paciente dijo que puede hacer.
  if (plan.comidas.length !== contexto.comidasPorDia) {
    motivos.push(
      `El paciente hace ${contexto.comidasPorDia} comidas al día y el borrador propone ${plan.comidas.length}.`,
    );
  }

  return resultado(motivos);
}

export function validarReceta(
  receta: RecetaBorrador,
  contexto: ContextoPaciente,
): ResultadoValidacion {
  const alergenos = alergenosEn(
    [receta.nombre, receta.pasos, ...receta.ingredientes].join(' '),
    contexto.alergias,
  );
  return resultado(
    alergenos.length > 0
      ? [
          `La receta incluye alérgenos declarados por el paciente: ${alergenos.join(', ')}. Propón una versión sin ellos.`,
        ]
      : [],
  );
}
