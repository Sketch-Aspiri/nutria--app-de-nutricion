import type { Food } from '@prisma/client';

import {
  type AlimentoFicha,
  type Equivalentes,
  esGrupoAlimento,
  type FuenteAlimento,
  type GrupoAlimento,
} from '@nutria/shared';

/**
 * Conversión de una fila de `foods` al JSON público de `/api/v1/foods`.
 * Campos en snake_case, según `rules/api-conventions.md`.
 */

/** Grupo de respaldo si una fila vieja quedó con un valor fuera del catálogo. */
const GRUPO_POR_DEFECTO: GrupoAlimento = 'libres';

function comoGrupo(valor: string): GrupoAlimento {
  return esGrupoAlimento(valor) ? valor : GRUPO_POR_DEFECTO;
}

/** La columna es `Json`: se filtra a números para no romper la aritmética. */
function comoEquivalentes(valor: unknown): Equivalentes {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return {};

  const equivalentes: Equivalentes = {};
  for (const [grupo, cantidad] of Object.entries(valor)) {
    if (esGrupoAlimento(grupo) && typeof cantidad === 'number' && Number.isFinite(cantidad)) {
      equivalentes[grupo] = cantidad;
    }
  }

  return equivalentes;
}

export function serializarAlimento(alimento: Food, nutritionistId: string): AlimentoFicha {
  return {
    id: alimento.id,
    nombre: alimento.nombre,
    grupo: comoGrupo(alimento.grupoSmae),
    subgrupo: alimento.subgrupo,
    porcion_descripcion: alimento.porcionDescripcion,
    porcion_gramos: alimento.porcionGramos,
    energia_kcal: alimento.energiaKcal,
    proteina_g: alimento.proteinaG,
    lipidos_g: alimento.lipidosG,
    carbohidratos_g: alimento.carbohidratosG,
    saturadas_g: alimento.saturadasG,
    colesterol_mg: alimento.colesterolMg,
    fibra_g: alimento.fibraG,
    azucar_g: alimento.azucarG,
    sodio_mg: alimento.sodioMg,
    potasio_mg: alimento.potasioMg,
    calcio_mg: alimento.calcioMg,
    hierro_mg: alimento.hierroMg,
    acido_folico_ug: alimento.acidoFolicoUg,
    vitamina_a_ug: alimento.vitaminaAUg,
    vitamina_c_mg: alimento.vitaminaCMg,
    indice_glicemico: alimento.indiceGlicemico,
    equivalentes: comoEquivalentes(alimento.equivalentes),
    imagen_url: alimento.imagenUrl,
    fuente: alimento.fuente.toLowerCase() as FuenteAlimento,
    es_propio: alimento.nutritionistId === nutritionistId,
  };
}
