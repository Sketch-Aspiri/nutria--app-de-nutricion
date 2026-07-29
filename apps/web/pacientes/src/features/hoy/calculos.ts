import type { ComidaPlanHoy, RegistroComidaHoy, ResumenHoy, TotalesNutricionales } from './types';

const VACIO: TotalesNutricionales = {
  calorias: 0,
  proteina: 0,
  carbos: 0,
  grasa: 0,
};

function numero(valor: number | null | undefined): number {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
}

function redondear(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/** Suma los snapshots del plan; no recalcula nutrientes desde el catálogo actual. */
export function totalesDeComida(comida: ComidaPlanHoy): TotalesNutricionales {
  return comida.items.reduce<TotalesNutricionales>(
    (total, item) => ({
      calorias: total.calorias + numero(item.energia_kcal),
      proteina: total.proteina + numero(item.proteina_g),
      carbos: total.carbos + numero(item.carbohidratos_g),
      grasa: total.grasa + numero(item.lipidos_g),
    }),
    { ...VACIO },
  );
}

/**
 * Forma que acepta `POST /meal_logs` al marcar una comida del plan.
 *
 * Los snapshots admiten medias porciones y por eso sus kcal son Float, pero el
 * contrato del registro persiste kcal enteras. El redondeo ocurre una sola vez
 * aquí y se comparte entre la mutación y su reflejo optimista.
 */
export function nutrientesParaRegistroPlan(comida: ComidaPlanHoy): TotalesNutricionales {
  const nutrientes = totalesDeComida(comida);
  return { ...nutrientes, calorias: Math.round(nutrientes.calorias) };
}

/**
 * Nutrientes consumidos hoy.
 *
 * Un marcador antiguo del plan puede no tener macros propios; en ese caso se
 * usa el snapshot de esa comida. Los marcadores duplicados se cuentan una sola
 * vez, mientras que cada registro libre sí suma por separado.
 */
export function calcularTotalesHoy(resumen: ResumenHoy): TotalesNutricionales {
  const comidas = new Map(resumen.plan?.comidas.map((comida) => [comida.id, comida]) ?? []);
  const marcadoresContados = new Set<string>();

  const totales = resumen.registros.reduce<TotalesNutricionales>(
    (total, registro) => {
      let nutrientes = nutrientesDeRegistro(registro);

      if (registro.meal_plan_meal_id) {
        if (marcadoresContados.has(registro.meal_plan_meal_id)) return total;
        marcadoresContados.add(registro.meal_plan_meal_id);

        const comida = comidas.get(registro.meal_plan_meal_id);
        if (comida) {
          const plan = totalesDeComida(comida);
          nutrientes = {
            calorias: registro.calorias === null ? plan.calorias : nutrientes.calorias,
            proteina: registro.proteina_g === null ? plan.proteina : nutrientes.proteina,
            carbos: registro.carbos_g === null ? plan.carbos : nutrientes.carbos,
            grasa: registro.grasa_g === null ? plan.grasa : nutrientes.grasa,
          };
        }
      }

      return {
        calorias: total.calorias + nutrientes.calorias,
        proteina: total.proteina + nutrientes.proteina,
        carbos: total.carbos + nutrientes.carbos,
        grasa: total.grasa + nutrientes.grasa,
      };
    },
    { ...VACIO },
  );

  return {
    calorias: Math.round(totales.calorias),
    proteina: redondear(totales.proteina),
    carbos: redondear(totales.carbos),
    grasa: redondear(totales.grasa),
  };
}

function nutrientesDeRegistro(registro: RegistroComidaHoy): TotalesNutricionales {
  return {
    calorias: numero(registro.calorias),
    proteina: numero(registro.proteina_g),
    carbos: numero(registro.carbos_g),
    grasa: numero(registro.grasa_g),
  };
}

export function descripcionDeComida(comida: ComidaPlanHoy): string {
  if (comida.descripcion?.trim()) return comida.descripcion;
  const alimentos = comida.items
    .map((item) => item.food?.nombre ?? item.descripcion_libre)
    .filter((nombre): nombre is string => Boolean(nombre));
  return alimentos.length > 0 ? alimentos.join(' · ') : 'Consulta los detalles en tu plan.';
}
