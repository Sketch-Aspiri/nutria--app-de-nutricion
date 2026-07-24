import type { AlimentoFicha, CalculoNutricional } from '@nutria/shared';

import type { PlanBorradorIa } from '@/services/ia';
import type {
  AlimentoResumenPlan,
  ComidaPlanEstructura,
  GuardarPlanPayload,
  ItemPlanEstructura,
  PlanApi,
} from '@/services/planes';

export type ItemPlanEditable = ItemPlanEstructura & {
  clave: string;
  id?: string;
  food?: PlanApi['comidas'][number]['items'][number]['food'];
};

export type ComidaPlanEditable = Omit<ComidaPlanEstructura, 'items'> & {
  clave: string;
  id?: string;
  items: ItemPlanEditable[];
};

export type PlanEditable = {
  id: string | null;
  updated_at: string | null;
  estado: PlanApi['estado'];
  calorias_diarias: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  nota: string | null;
  origen: PlanApi['origen'];
  compartido_at: string | null;
  pdf_url: string | null;
  comidas: ComidaPlanEditable[];
};

const NOMBRES_COMIDA = [
  'Desayuno',
  'Colación matutina',
  'Comida',
  'Colación vespertina',
  'Cena',
  'Colación nocturna',
];

let secuenciaLocal = 0;

function claveLocal(prefijo: string): string {
  secuenciaLocal += 1;
  return `${prefijo}-${Date.now()}-${secuenciaLocal}`;
}

export function nuevaComida(orden: number, nombre?: string): ComidaPlanEditable {
  return {
    clave: claveLocal('comida'),
    orden,
    nombre: nombre ?? NOMBRES_COMIDA[orden] ?? `Comida ${orden + 1}`,
    horario: null,
    descripcion: null,
    items: [],
  };
}

export function estructuraAEditable(
  comidas: Array<
    Omit<ComidaPlanEstructura, 'items'> & {
      items: Array<ItemPlanEstructura & { food?: AlimentoResumenPlan | null }>;
    }
  >,
): ComidaPlanEditable[] {
  return comidas.map((comida) => ({
    ...comida,
    clave: claveLocal('comida'),
    items: comida.items.map((item) => ({
      ...item,
      clave: claveLocal('item'),
      food: item.food ?? null,
    })),
  }));
}

export function editablesAEstructura(
  comidas: ComidaPlanEditable[],
  incluirIds = false,
): ComidaPlanEstructura[] {
  return comidas.map(({ id, orden, nombre, horario, descripcion, items }) => ({
    ...(incluirIds && id ? { id } : {}),
    orden,
    nombre,
    horario: horario || null,
    descripcion: descripcion || null,
    items: items.map(
      ({
        id: itemId,
        food_id,
        descripcion_libre,
        cantidad_porciones,
        energia_kcal,
        proteina_g,
        carbohidratos_g,
        lipidos_g,
      }) => ({
        ...(incluirIds && itemId ? { id: itemId } : {}),
        food_id,
        descripcion_libre,
        cantidad_porciones,
        energia_kcal,
        proteina_g,
        carbohidratos_g,
        lipidos_g,
      }),
    ),
  }));
}

export function crearPlanVacio(
  calculo: CalculoNutricional | null,
  numeroComidas: number,
): PlanEditable {
  const cantidad = Math.min(Math.max(numeroComidas, 1), 8);

  return {
    id: null,
    updated_at: null,
    estado: 'BORRADOR',
    calorias_diarias: calculo?.objetivoCalorias ?? 0,
    proteina_g: calculo?.proteina_g ?? 0,
    carbos_g: calculo?.carbos_g ?? 0,
    grasa_g: calculo?.grasa_g ?? 0,
    nota: null,
    origen: 'MANUAL',
    compartido_at: null,
    pdf_url: null,
    comidas: Array.from({ length: cantidad }, (_, indice) => nuevaComida(indice)),
  };
}

/**
 * Convierte el borrador que devuelve `/api/v1/ai/generate` en un plan editable.
 *
 * Es una traducción directa: el servidor ya resolvió los `food_id` contra el
 * catálogo y calculó los nutrimentos de cada item, así que aquí no se reparte
 * ni se estima nada — solo se agregan las claves locales del editor.
 */
export function borradorIaAEditable(borrador: PlanBorradorIa): PlanEditable {
  return {
    id: null,
    updated_at: null,
    estado: 'BORRADOR',
    calorias_diarias: borrador.calorias_diarias,
    proteina_g: borrador.proteina_g,
    carbos_g: borrador.carbos_g,
    grasa_g: borrador.grasa_g,
    nota: borrador.nota || 'Borrador generado con IA; requiere revisión profesional.',
    origen: 'IA',
    compartido_at: null,
    pdf_url: null,
    comidas: borrador.comidas.map((comida) => ({
      clave: claveLocal('comida'),
      orden: comida.orden,
      nombre: comida.nombre,
      horario: comida.horario,
      descripcion: comida.descripcion,
      items: comida.items.map((item) => ({ ...item, clave: claveLocal('item') })),
    })),
  };
}

export function planAEditable(plan: PlanApi): PlanEditable {
  const comidas = plan.comidas.map((comida) => ({
    ...comida,
    clave: comida.id,
    items: comida.items.map((item) => ({ ...item, clave: item.id })),
  }));

  return {
    id: plan.id,
    updated_at: plan.updated_at,
    estado: plan.estado,
    calorias_diarias: plan.calorias_diarias,
    proteina_g: plan.proteina_g,
    carbos_g: plan.carbos_g,
    grasa_g: plan.grasa_g,
    nota: plan.nota,
    origen: plan.origen,
    compartido_at: plan.compartido_at,
    pdf_url: plan.pdf_url,
    comidas: comidas.length > 0 ? comidas : [nuevaComida(0)],
  };
}

export function alimentoAItem(alimento: AlimentoFicha): ItemPlanEditable {
  return {
    clave: claveLocal('item'),
    food_id: alimento.id,
    descripcion_libre: null,
    cantidad_porciones: 1,
    energia_kcal: alimento.energia_kcal,
    proteina_g: alimento.proteina_g,
    carbohidratos_g: alimento.carbohidratos_g,
    lipidos_g: alimento.lipidos_g,
    food: {
      id: alimento.id,
      nombre: alimento.nombre,
      grupo: alimento.grupo,
      porcion_descripcion: alimento.porcion_descripcion,
      porcion_gramos: alimento.porcion_gramos,
      imagen_url: alimento.imagen_url,
    },
  };
}

export function nuevoItemLibre(): ItemPlanEditable {
  return {
    clave: claveLocal('item'),
    food_id: null,
    descripcion_libre: '',
    cantidad_porciones: 1,
    energia_kcal: 0,
    proteina_g: 0,
    carbohidratos_g: 0,
    lipidos_g: 0,
    food: null,
  };
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Los snapshots ya vienen escalados; al cambiar cantidad se reescala desde el valor previo. */
export function cambiarCantidadItem(
  item: ItemPlanEditable,
  cantidad: number,
): ItemPlanEditable {
  const segura = Number.isFinite(cantidad) ? Math.max(cantidad, 0.05) : item.cantidad_porciones;
  const factor = item.cantidad_porciones > 0 ? segura / item.cantidad_porciones : segura;

  return {
    ...item,
    cantidad_porciones: segura,
    energia_kcal: redondear(item.energia_kcal * factor),
    proteina_g: redondear(item.proteina_g * factor),
    carbohidratos_g: redondear(item.carbohidratos_g * factor),
    lipidos_g: redondear(item.lipidos_g * factor),
  };
}

export function normalizarOrden(comidas: ComidaPlanEditable[]): ComidaPlanEditable[] {
  return comidas.map((comida, orden) => ({ ...comida, orden }));
}

export function planAPayload(plan: PlanEditable): GuardarPlanPayload {
  return {
    ...(plan.updated_at ? { expected_updated_at: plan.updated_at } : {}),
    estado: plan.estado,
    calorias_diarias: Math.max(0, Math.round(plan.calorias_diarias)),
    proteina_g: Math.max(0, Math.round(plan.proteina_g)),
    carbos_g: Math.max(0, Math.round(plan.carbos_g)),
    grasa_g: Math.max(0, Math.round(plan.grasa_g)),
    nota: plan.nota,
    origen: plan.origen,
    comidas: editablesAEstructura(plan.comidas, true),
  };
}

export type TotalesPlan = {
  energia_kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  lipidos_g: number;
};

export function calcularTotalesPlan(plan: PlanEditable): TotalesPlan {
  return plan.comidas.reduce<TotalesPlan>(
    (total, comida) =>
      comida.items.reduce<TotalesPlan>(
        (subtotal, item) => ({
          energia_kcal: redondear(subtotal.energia_kcal + item.energia_kcal),
          proteina_g: redondear(subtotal.proteina_g + item.proteina_g),
          carbohidratos_g: redondear(
            subtotal.carbohidratos_g + item.carbohidratos_g,
          ),
          lipidos_g: redondear(subtotal.lipidos_g + item.lipidos_g),
        }),
        total,
      ),
    { energia_kcal: 0, proteina_g: 0, carbohidratos_g: 0, lipidos_g: 0 },
  );
}

export function itemTieneContenido(item: ItemPlanEditable): boolean {
  return Boolean(item.food_id || item.descripcion_libre?.trim());
}
