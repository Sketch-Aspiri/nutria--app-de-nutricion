import { nutrientesParaRegistroPlan } from './calculos';
import type { ComidaPlanHoy, RegistroComidaHoy, ResumenHoy } from './types';

export function marcarComidaOptimista(resumen: ResumenHoy, comida: ComidaPlanHoy): ResumenHoy {
  if (resumen.comidas_marcadas.includes(comida.id)) return resumen;
  const nutrientes = nutrientesParaRegistroPlan(comida);
  const ahora = new Date().toISOString();
  const registro: RegistroComidaHoy = {
    id: `optimista-${comida.id}`,
    meal_plan_meal_id: comida.id,
    fecha: ahora,
    dia: resumen.dia,
    hora: ahora,
    nombre: comida.nombre,
    calorias: nutrientes.calorias,
    proteina_g: nutrientes.proteina,
    carbos_g: nutrientes.carbos,
    grasa_g: nutrientes.grasa,
    origen: 'MANUAL',
    foto_url: null,
    comentario_paciente: null,
    created_at: ahora,
  };
  return {
    ...resumen,
    comidas_marcadas: [...resumen.comidas_marcadas, comida.id],
    registros: [...resumen.registros, registro],
  };
}

export function desmarcarComidaOptimista(
  resumen: ResumenHoy,
  comidaId: string,
  registroIds: string[],
): ResumenHoy {
  const ids = new Set(registroIds);
  return {
    ...resumen,
    comidas_marcadas: resumen.comidas_marcadas.filter((id) => id !== comidaId),
    registros: resumen.registros.filter((registro) => !ids.has(registro.id)),
  };
}

export function cambiarAguaOptimista(resumen: ResumenHoy, vasos: number): ResumenHoy {
  return { ...resumen, agua: { ...resumen.agua, vasos } };
}
