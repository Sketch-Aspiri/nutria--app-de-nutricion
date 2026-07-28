'use client';

import { AlertTriangle, Calculator, Check, Loader2, Pencil, Save } from 'lucide-react';
import { useMemo, useState } from 'react';

import type {
  DatosSnapshot,
  EcuacionBmr,
  ModoProteina,
  Paciente,
  SnapshotCalculo,
} from '@nutria/shared';
import { ECUACION_POR_DEFECTO, construirSnapshotCalculo } from '@nutria/shared';

import { ComparativaEcuaciones } from '@/components/pacientes/calculo/ComparativaEcuaciones';
import { FormPliegues } from '@/components/pacientes/calculo/FormPliegues';
import { PanelAntropometria } from '@/components/pacientes/calculo/PanelAntropometria';
import { PanelEquivalentes } from '@/components/pacientes/calculo/PanelEquivalentes';
import { PanelResultado } from '@/components/pacientes/calculo/PanelResultado';
import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';
import { useGuardarCalculo } from '@/hooks/usePacientes';
import { ApiError, type CalculoApi } from '@/services/pacientes';

type Opciones = {
  ecuacion: EcuacionBmr;
  modoProteina: ModoProteina;
  proteinaGPorKg: string;
  usarPesoAjustado: boolean;
};

/** Al abrir la pestaña se reproduce el último cálculo guardado, no un default. */
function opcionesDesde(calculo: CalculoApi | null): Opciones {
  const entradas = calculo?.snapshot?.entradas;
  return {
    ecuacion: calculo?.snapshot?.resultado.ecuacion ?? ECUACION_POR_DEFECTO,
    modoProteina: entradas?.modoProteina ?? 'porcentaje',
    proteinaGPorKg: entradas?.proteinaGPorKg?.toString() ?? '',
    usarPesoAjustado: entradas?.usarPesoAjustado ?? false,
  };
}

function entradaDeCalculo(paciente: Paciente, opciones: Opciones): DatosSnapshot {
  const a = paciente.antropometria;
  const gPorKg = Number(opciones.proteinaGPorKg);

  return {
    peso: a.peso,
    altura: a.altura,
    edad: paciente.edad,
    genero: paciente.genero,
    nivelActividad: paciente.medico.nivelActividad,
    objetivo: paciente.medico.objetivo,
    condiciones: paciente.medico.condiciones,
    cintura: a.cintura || undefined,
    cadera: a.cadera || undefined,
    grasaPct: a.grasaCorporal || undefined,
    pliegues: a.pliegues,
    ecuacion: opciones.ecuacion,
    modoProteina: opciones.modoProteina,
    proteinaGPorKg: Number.isFinite(gPorKg) && gPorKg > 0 ? gPorKg : undefined,
    usarPesoAjustado: opciones.usarPesoAjustado,
  };
}

/**
 * Qué le falta al expediente para poder calcular. Se enumera en vez de dar un
 * mensaje genérico: el nutriólogo necesita saber qué campo abrir a corregir.
 */
function datosFaltantes(paciente: Paciente): string[] {
  const faltantes: string[] = [];
  if (!paciente.antropometria.peso) faltantes.push('peso');
  if (!paciente.antropometria.altura) faltantes.push('altura');
  if (!paciente.edad) faltantes.push('fecha de nacimiento');
  return faltantes;
}

function listaEnEspanol(valores: string[]): string {
  if (valores.length <= 1) return valores.join('');
  return `${valores.slice(0, -1).join(', ')} y ${valores[valores.length - 1]}`;
}

/**
 * Pestaña de cálculo clínico.
 *
 * La vista previa se calcula en el navegador con las mismas funciones puras de
 * `packages/shared` que usa el backend, para que cambiar de ecuación sea
 * instantáneo. Al guardar, el servidor **recalcula desde el expediente** y
 * archiva su propio snapshot: lo que se audita nunca son números del cliente.
 */
export function TabCalculo({
  paciente,
  calculo,
  onEditar,
}: {
  paciente: Paciente;
  calculo: CalculoApi | null;
  /** Abre la edición del expediente para completar lo que falte. */
  onEditar?: () => void;
}) {
  const [opciones, setOpciones] = useState<Opciones>(() => opcionesDesde(calculo));
  const guardar = useGuardarCalculo(paciente.id);

  const vistaPrevia = useMemo<
    { ok: true; snapshot: SnapshotCalculo } | { ok: false; motivo: string }
  >(() => {
    try {
      return { ok: true, snapshot: construirSnapshotCalculo(entradaDeCalculo(paciente, opciones)) };
    } catch {
      const faltantes = datosFaltantes(paciente);
      return {
        ok: false,
        motivo: faltantes.length
          ? `Falta capturar ${listaEnEspanol(faltantes)} en el expediente para calcular el gasto energético.`
          : 'No pudimos calcular con los datos del expediente. Revisa que las medidas sean plausibles.',
      };
    }
  }, [paciente, opciones]);

  const cambiar = <Clave extends keyof Opciones>(clave: Clave, valor: Opciones[Clave]) =>
    setOpciones((previas) => ({ ...previas, [clave]: valor }));

  const enviar = () =>
    guardar.mutate({
      ecuacion: opciones.ecuacion,
      modo_proteina: opciones.modoProteina,
      proteina_g_por_kg: Number(opciones.proteinaGPorKg) || null,
      usar_peso_ajustado: opciones.usarPesoAjustado,
    });

  if (!vistaPrevia.ok) {
    return (
      <div className="space-y-4 max-w-3xl">
        <SectionCard title="Gasto energético" icon={Calculator}>
          <div className="flex items-start gap-2 text-sm text-orange-700">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {vistaPrevia.motivo}
          </div>
          {onEditar && (
            <Btn variant="outline" size="sm" className="mt-3" onClick={onEditar}>
              <Pencil size={14} /> Completar expediente
            </Btn>
          )}
        </SectionCard>
        <FormPliegues pacienteId={paciente.id} antropometria={paciente.antropometria} />
      </div>
    );
  }

  const { snapshot } = vistaPrevia;

  return (
    <div className="space-y-4 max-w-3xl">
      <SectionCard title="Gasto energético" icon={Calculator}>
        <p className="text-sm text-stone-500">
          Cálculo determinístico a partir del expediente ({paciente.antropometria.peso} kg,{' '}
          {paciente.antropometria.altura} cm, {paciente.edad} años,{' '}
          {paciente.medico.nivelActividad.toLowerCase()}, objetivo{' '}
          {paciente.medico.objetivo.toLowerCase()}). No es una estimación de la IA — es una fórmula
          clínica que puedes defender ante el paciente.
        </p>
      </SectionCard>

      <PanelAntropometria resumen={snapshot.antropometria} />

      <ComparativaEcuaciones
        filas={snapshot.comparativa}
        seleccionada={opciones.ecuacion}
        onSeleccionar={(ecuacion) => cambiar('ecuacion', ecuacion)}
      />

      <SectionCard title="Ajustes clínicos" icon={Calculator}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl} htmlFor="modo-proteina">
              Cómo fijar la proteína
            </label>
            <select
              id="modo-proteina"
              className={inp}
              value={opciones.modoProteina}
              onChange={(evento) => cambiar('modoProteina', evento.target.value as ModoProteina)}
            >
              <option value="porcentaje">Porcentaje de las calorías</option>
              <option value="g_por_kg">Gramos por kilo de peso</option>
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="proteina-g-kg">
              Proteína (g/kg)
            </label>
            <input
              id="proteina-g-kg"
              type="number"
              min="0.4"
              max="3"
              step="0.1"
              inputMode="decimal"
              className={inp}
              placeholder="Sugerida por el objetivo"
              disabled={opciones.modoProteina !== 'g_por_kg'}
              value={opciones.proteinaGPorKg}
              onChange={(evento) => cambiar('proteinaGPorKg', evento.target.value)}
            />
          </div>
        </div>
        <label
          htmlFor="usar-peso-ajustado"
          className="flex items-center gap-2 text-sm text-stone-600 mt-4 w-fit"
        >
          <input
            id="usar-peso-ajustado"
            type="checkbox"
            className="accent-emerald-800"
            checked={opciones.usarPesoAjustado}
            onChange={(evento) => cambiar('usarPesoAjustado', evento.target.checked)}
          />
          Calcular con peso ajustado ({snapshot.antropometria.pesoAjustado} kg)
        </label>
      </SectionCard>

      <PanelResultado resultado={snapshot.resultado} />
      <PanelEquivalentes distribucion={snapshot.equivalentes} />
      <FormPliegues pacienteId={paciente.id} antropometria={paciente.antropometria} />

      <div className="flex items-center gap-3">
        <Btn onClick={enviar} disabled={guardar.isPending}>
          {guardar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar cálculo en el plan
        </Btn>
        {calculo && !guardar.isPending && (
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <Check size={13} className="text-emerald-700" />
            Último guardado:{' '}
            {new Date(calculo.guardado_en).toLocaleString('es-MX', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        )}
      </div>

      {guardar.error && (
        <div className="flex items-start gap-2 text-sm text-orange-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {guardar.error instanceof ApiError
            ? guardar.error.message
            : 'No pudimos guardar el cálculo. Intenta de nuevo.'}
        </div>
      )}
    </div>
  );
}
