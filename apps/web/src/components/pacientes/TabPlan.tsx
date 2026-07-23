'use client';

import { AlertTriangle, LayoutTemplate, Loader2, Sparkles, Utensils } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Alimento, Paciente, PlanAlimenticio, PlantillaPlan } from '@nutria/shared';
import { NOMBRE_ECUACION } from '@nutria/shared';

import { FoodPicker } from '@/components/pacientes/FoodPicker';
import { PdfPreview } from '@/components/pacientes/PdfPreview';
import { PlanEditor } from '@/components/pacientes/PlanEditor';
import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { SectionCard } from '@/components/ui/SectionCard';
import { useGenerarJSON } from '@/hooks/useIA';
import { useAppState } from '@/store/app-state';

function promptPlan(paciente: Paciente, notas: string): string {
  // La ecuación la elige el nutriólogo en la pestaña de cálculo: se nombra la
  // que realmente produjo la meta, no una fija.
  const metaTexto = paciente.calculo
    ? `Meta calculada (${NOMBRE_ECUACION[paciente.calculo.ecuacion]}): ${paciente.calculo.objetivoCalorias} kcal, ${paciente.calculo.proteina_g}g proteína, ${paciente.calculo.carbos_g}g carbos, ${paciente.calculo.grasa_g}g grasa. Ajústate a estos números.`
    : '';
  return `Eres un asistente para nutriólogos certificados. Genera un BORRADOR de plan alimenticio de un día para que el profesional lo revise y apruebe. Nunca es final ni se usa sin supervisión.
Paciente: ${paciente.nombre}, ${paciente.edad} años, ${paciente.antropometria.peso} kg, ${paciente.antropometria.altura} cm. Objetivo: ${paciente.medico.objetivo}. Condiciones: ${paciente.medico.condiciones.join(', ')}. Dieta: ${paciente.preferencias.tipoDieta}. Alergias: ${paciente.preferencias.alergias.join(', ')}. No le gusta: ${paciente.preferencias.disgustos || 'nada'}. Comidas al día: ${paciente.preferencias.comidasPorDia}.
${metaTexto}
Notas del nutriólogo: ${notas || 'ninguna'}
Responde SOLO con JSON: {"calorias_diarias": number, "macros": {"proteina_g": number, "carbos_g": number, "grasa_g": number}, "comidas": [{"nombre": string, "horario": string, "descripcion": string, "porcion": string, "calorias": number}], "nota_ia": string}`;
}

export function TabPlan({ paciente }: { paciente: Paciente }) {
  const { marca, plantillas, updatePatient } = useAppState();
  const [notas, setNotas] = useState('');
  const [borrador, setBorrador] = useState<PlanAlimenticio | null>(paciente.planActivo);
  const [foodPicker, setFoodPicker] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const generarPlan = useGenerarJSON<PlanAlimenticio>();

  // Al cambiar de paciente se recarga su plan activo.
  useEffect(() => setBorrador(paciente.planActivo), [paciente.id, paciente.planActivo]);

  const generar = () => {
    generarPlan.mutate(
      { prompt: promptPlan(paciente, notas) },
      { onSuccess: (plan) => setBorrador(plan) },
    );
  };

  const agregarAlimento = (al: Alimento) => {
    setBorrador((b) => {
      const base: PlanAlimenticio =
        b ?? { calorias_diarias: 0, macros: { proteina_g: 0, carbos_g: 0, grasa_g: 0 }, comidas: [] };
      return {
        ...base,
        comidas: [
          ...base.comidas,
          {
            nombre: al.nombre,
            horario: '—',
            descripcion: `${al.porcion} de ${al.nombre.toLowerCase()}`,
            porcion: al.porcion,
            calorias: al.kcal,
          },
        ],
      };
    });
    setFoodPicker(false);
  };

  const aplicarPlantilla = (pl: PlantillaPlan) => {
    setBorrador({
      calorias_diarias: pl.calorias,
      macros: { proteina_g: 0, carbos_g: 0, grasa_g: 0 },
      comidas: [{ nombre: 'Comida base', horario: '—', descripcion: pl.descripcion, porcion: '', calorias: pl.calorias }],
      nota_ia: `Basado en plantilla: ${pl.nombre}`,
    });
    setShowPlantillas(false);
  };

  const compartir = () => {
    if (!borrador) return;
    const compartido = { ...borrador, compartido: new Date().toLocaleString('es-MX') };
    setBorrador(compartido);
    updatePatient(paciente.id, { planActivo: compartido });
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="Generar plan"
        icon={Sparkles}
        action={
          <div className="flex gap-2">
            <Btn size="sm" variant="outline" onClick={() => setShowPlantillas(true)}>
              <LayoutTemplate size={13} /> Plantilla
            </Btn>
            <Btn size="sm" variant="outline" onClick={() => setFoodPicker(true)}>
              <Utensils size={13} /> Base de alimentos
            </Btn>
          </div>
        }
      >
        {!paciente.calculo && (
          <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
            <AlertTriangle size={13} /> Tip: calcula el requerimiento en la pestaña
            &quot;Cálculo&quot; para que la IA se ajuste a metas exactas.
          </div>
        )}
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej. priorizar desayunos rápidos, más fibra, 4 comidas..."
          className="w-full border border-stone-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-emerald-400"
          rows={2}
        />
        <Btn onClick={generar} disabled={generarPlan.isPending} className="mt-3">
          {generarPlan.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generarPlan.isPending ? 'Generando...' : 'Generar borrador con IA'}
        </Btn>
        {generarPlan.isError && (
          <div className="text-orange-600 text-xs mt-2">
            {generarPlan.error instanceof SyntaxError
              ? 'La IA devolvió un formato inesperado. Intenta de nuevo.'
              : generarPlan.error.message}
          </div>
        )}
      </SectionCard>

      {borrador && (
        <PlanEditor
          paciente={paciente}
          borrador={borrador}
          onChange={(fn) => setBorrador((b) => (b ? fn(b) : b))}
          onCompartir={compartir}
          onExportar={() => setShowPdf(true)}
          onDescartar={() => setBorrador(null)}
        />
      )}

      {foodPicker && <FoodPicker onAdd={agregarAlimento} onClose={() => setFoodPicker(false)} />}
      {showPdf && borrador && (
        <PdfPreview paciente={paciente} plan={borrador} marca={marca} onClose={() => setShowPdf(false)} />
      )}
      {showPlantillas && (
        <Modal>
          <div className="p-6">
            <ModalHeader title="Aplicar plantilla" onClose={() => setShowPlantillas(false)} />
            <div className="space-y-2">
              {plantillas.map((pl) => (
                <button
                  type="button"
                  key={pl.id}
                  onClick={() => aplicarPlantilla(pl)}
                  className="w-full text-left border border-stone-200 rounded-lg p-3 hover:border-emerald-300"
                >
                  <div className="flex justify-between">
                    <span className="text-sm text-emerald-950 font-medium">{pl.nombre}</span>
                    <span className="font-mono text-xs text-stone-400">{pl.calorias} kcal</span>
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">{pl.descripcion}</div>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
