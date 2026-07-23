'use client';

import {
  AlertTriangle,
  CalendarDays,
  FilePlus2,
  LayoutTemplate,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';

import { objetivoADb, type Paciente } from '@nutria/shared';

import { AiPlanDraft } from '@/components/planes/AiPlanDraft';
import { planAPayload } from '@/components/planes/editor-model';
import { SaveTemplateModal } from '@/components/planes/SaveTemplateModal';
import { TemplatePicker } from '@/components/planes/TemplatePicker';
import { FoodPicker } from '@/components/pacientes/FoodPicker';
import { PdfPreview } from '@/components/pacientes/PdfPreview';
import { PlanEditor } from '@/components/pacientes/PlanEditor';
import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import {
  useCrearPlantilla,
  usePlanWorkspace,
  usePlantillasPlanes,
} from '@/hooks/usePlanes';

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function TabPlan({ paciente }: { paciente: Paciente }) {
  const workspace = usePlanWorkspace(paciente);
  const { plantillas, cargando: cargandoPlantillas, error: errorPlantillas } =
    usePlantillasPlanes();
  const crearPlantilla = useCrearPlantilla();
  const [comidaParaAlimento, setComidaParaAlimento] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [showGuardarPlantilla, setShowGuardarPlantilla] = useState(false);

  const plan = workspace.plan;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Planes alimenticios"
        icon={CalendarDays}
        action={
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" variant="outline" onClick={() => setShowPlantillas(true)}>
              <LayoutTemplate size={13} /> Aplicar plantilla
            </Btn>
            <Btn size="sm" onClick={workspace.nuevo}>
              <FilePlus2 size={13} /> Nuevo plan
            </Btn>
          </div>
        }
      >
        {!paciente.calculo && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Calcula primero el requerimiento para traer metas clínicas al nuevo plan. No asignamos
            una meta automática sin ese cálculo.
          </div>
        )}

        {workspace.planes.length > 0 && (
          <label className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            Historial
            <select
              value={plan?.id ?? ''}
              onChange={(evento) => workspace.seleccionar(evento.target.value)}
              className="min-w-64 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-500 focus:outline-none"
            >
              {!plan?.id && <option value="">Plan nuevo sin guardar</option>}
              {workspace.planes.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.estado === 'ACTIVO'
                    ? 'Activo'
                    : opcion.estado === 'BORRADOR'
                      ? 'Borrador'
                      : 'Archivado'}
                  {' · '}
                  {fechaCorta(opcion.updated_at)}
                  {' · '}
                  {opcion.calorias_diarias} kcal
                </option>
              ))}
            </select>
          </label>
        )}

        {workspace.cargando && (
          <div className="flex items-center gap-2 py-4 text-sm text-stone-400">
            <Loader2 size={15} className="animate-spin" /> Cargando planes…
          </div>
        )}
        {(workspace.error || (!plan && workspace.errorAccion)) && (
          <p role="alert" className="mt-3 text-xs text-orange-600">
            {workspace.error?.message ?? workspace.errorAccion}
          </p>
        )}
      </SectionCard>

      <AiPlanDraft paciente={paciente} onGenerated={workspace.usarBorradorIa} />

      {!workspace.cargando && !plan && !workspace.error && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
            <FilePlus2 size={20} />
          </div>
          <h3 className="font-display text-lg font-medium text-emerald-950">
            Diseña el primer plan
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-stone-500">
            Organiza comidas, liga alimentos de la base y revisa el balance antes de activarlo.
          </p>
          <Btn className="mt-4" onClick={workspace.nuevo}>
            Crear borrador
          </Btn>
        </div>
      )}

      {plan && (
        <PlanEditor
          paciente={paciente}
          plan={plan}
          modificado={workspace.modificado}
          guardando={workspace.enCurso}
          error={workspace.errorAccion}
          onChange={workspace.cambiarPlan}
          onAddFood={setComidaParaAlimento}
          onSave={() => void workspace.guardar()}
          onActivate={() => void workspace.activarActual()}
          onShare={() => void workspace.compartirActual()}
          onDuplicate={() => void workspace.duplicarActual()}
          onExport={() => setShowPdf(true)}
          onSaveTemplate={() => setShowGuardarPlantilla(true)}
          onReset={workspace.restablecer}
        />
      )}

      {comidaParaAlimento && (
        <FoodPicker
          onAdd={(alimento) => {
            workspace.agregarAlimento(comidaParaAlimento, alimento);
            setComidaParaAlimento(null);
          }}
          onClose={() => setComidaParaAlimento(null)}
        />
      )}
      {showPdf && plan?.id && (
        <PdfPreview planId={plan.id} onClose={() => setShowPdf(false)} />
      )}
      {showPlantillas && (
        <TemplatePicker
          plantillas={plantillas}
          cargando={cargandoPlantillas}
          aplicando={workspace.aplicandoPlantilla}
          error={errorPlantillas?.message ?? null}
          onApply={(plantilla) =>
            void workspace.aplicarPlantilla(plantilla).then((aplicada) => {
              if (aplicada) setShowPlantillas(false);
            })
          }
          onClose={() => setShowPlantillas(false)}
        />
      )}
      {showGuardarPlantilla && plan && (
        <SaveTemplateModal
          objetivoInicial={objetivoADb(paciente.medico.objetivo)}
          calorias={plan.calorias_diarias}
          guardando={crearPlantilla.isPending}
          error={crearPlantilla.error?.message ?? null}
          onSave={(datos) =>
            crearPlantilla.mutate(
              {
                ...datos,
                estructura: { comidas: planAPayload(plan).comidas ?? [] },
              },
              { onSuccess: () => setShowGuardarPlantilla(false) },
            )
          }
          onClose={() => setShowGuardarPlantilla(false)}
        />
      )}
    </div>
  );
}
