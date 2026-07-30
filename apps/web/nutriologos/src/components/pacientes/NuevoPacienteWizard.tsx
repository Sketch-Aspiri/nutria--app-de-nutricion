'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { generoADb, nivelActividadADb, objetivoADb } from '@nutria/shared';

import {
  CamposAntropometria,
  CamposDatosGenerales,
  CamposExpedienteMedico,
  CamposPreferencias,
  FORM_PACIENTE_INICIAL,
  type FormPaciente,
  numeroOpcional,
} from '@/components/pacientes/camposPaciente';
import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { useCrearPaciente } from '@/hooks/usePacientes';
import { ApiError, type CrearPacientePayload } from '@/services/pacientes';

const PASOS = ['Datos generales', 'Expediente médico', 'Antropometría', 'Preferencias alimentarias'];

export function construirPayload(
  form: FormPaciente,
  consentimientoDatosSensibles = false,
): CrearPacientePayload {
  return {
    nombre: form.nombre.trim(),
    fecha_nacimiento: form.fechaNacimiento || null,
    genero: generoADb(form.genero),
    email: form.email.trim() || null,
    telefono: form.telefono.trim() || null,
    foto_url: form.foto,
    expediente_medico: {
      condiciones: form.condiciones,
      antecedentes: form.antecedentes.trim() || null,
      medicamentos: form.medicamentos.trim() || null,
      nivel_actividad: nivelActividadADb(form.nivelActividad),
      objetivo: objetivoADb(form.objetivo),
      // El servidor lo descarta si el objetivo no es 'Otro'; se manda igual
      // para que el payload refleje lo que el nutriólogo tenía en pantalla.
      objetivo_otro: form.objetivoOtro.trim() || null,
    },
    preferencias_alimentarias: {
      tipo_dieta: form.tipoDieta,
      alergias: form.alergias,
      disgustos: form.disgustos.trim() || null,
      comidas_por_dia: Number(form.comidasPorDia) || 3,
      presupuesto_tiempo: form.presupuestoTiempo,
    },
    antropometria: {
      peso_kg: numeroOpcional(form.peso),
      altura_cm: numeroOpcional(form.altura),
      cintura_cm: numeroOpcional(form.cintura),
      cadera_cm: numeroOpcional(form.cadera),
      grasa_pct: numeroOpcional(form.grasaCorporal),
    },
    consentimiento_datos_sensibles: consentimientoDatosSensibles,
    consentimiento_metodo: 'ESCRITO',
  };
}

type NuevoPacienteWizardProps = {
  onClose: () => void;
  onCreado: (id: string) => void;
};

export function NuevoPacienteWizard({ onClose, onCreado }: NuevoPacienteWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormPaciente>(FORM_PACIENTE_INICIAL);
  const [error, setError] = useState('');
  // El 402 del cupo del plan no se resuelve corrigiendo el formulario, así que
  // en vez de solo mostrar el mensaje se ofrece la salida: la página de planes.
  const [topeDePlan, setTopeDePlan] = useState(false);
  const [consentimiento, setConsentimiento] = useState(false);
  const crear = useCrearPaciente();

  const set = <Clave extends keyof FormPaciente>(clave: Clave, valor: FormPaciente[Clave]) =>
    setForm((previo) => ({ ...previo, [clave]: valor }));

  const guardar = async () => {
    setError('');
    setTopeDePlan(false);
    try {
      const paciente = await crear.mutateAsync(construirPayload(form, consentimiento));
      onCreado(paciente.id);
    } catch (fallo: unknown) {
      setTopeDePlan(fallo instanceof ApiError && fallo.code === 'PLAN_LIMIT');
      setError(
        fallo instanceof ApiError
          ? fallo.message
          : 'No pudimos guardar al paciente. Intenta de nuevo.',
      );
      // El expediente se captura en el paso 0: ahí se ven los errores de datos.
      if (fallo instanceof ApiError && fallo.details?.nombre) setStep(0);
    }
  };

  return (
    <Modal>
      <div className="p-4 sm:p-6 pb-0">
        <ModalHeader title="Nuevo paciente" onClose={onClose} />
        <div className="flex gap-1.5 mb-5">
          {PASOS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-emerald-800' : 'bg-stone-200'}`} />
          ))}
        </div>
        <div className="text-xs uppercase tracking-wide text-stone-400 mb-4">{PASOS[step]}</div>
      </div>
      <div className="px-6 space-y-3">
        {step === 0 && <CamposDatosGenerales form={form} set={set} />}
        {step === 1 && <CamposExpedienteMedico form={form} set={set} />}
        {step === 2 && <CamposAntropometria form={form} set={set} />}
        {step === 3 && <CamposPreferencias form={form} set={set} />}
        {step === 3 && (
          <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs leading-5 text-emerald-950">
            <input
              type="checkbox"
              required
              checked={consentimiento}
              onChange={(event) => setConsentimiento(event.target.checked)}
              className="mt-1"
            />
            <span>
              Confirmo que entregué al paciente el{' '}
              <Link
                href="/privacidad#pacientes"
                target="_blank"
                className="font-semibold underline underline-offset-2"
              >
                aviso de privacidad
              </Link>{' '}
              y que otorgó por escrito su consentimiento expreso para tratar datos personales
              sensibles de salud.
            </span>
          </label>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className={`mx-6 mt-4 text-xs rounded-lg px-3 py-2.5 border ${
            topeDePlan
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {error}
          {topeDePlan && (
            <Link
              href="/suscripcion"
              className="block mt-2 font-medium underline underline-offset-2"
            >
              Ver planes
            </Link>
          )}
        </div>
      )}
      <div className="flex justify-between p-6 pt-5">
        <Btn
          variant="ghost"
          disabled={crear.isPending}
          onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
        >
          {step === 0 ? 'Cancelar' : 'Atrás'}
        </Btn>
        {step < PASOS.length - 1 ? (
          <Btn onClick={() => setStep(step + 1)}>
            Siguiente <ChevronRight size={15} />
          </Btn>
        ) : (
          <Btn
            disabled={crear.isPending || !consentimiento}
            onClick={() => void guardar()}
          >
            {crear.isPending ? 'Guardando…' : 'Crear paciente'}
          </Btn>
        )}
      </div>
    </Modal>
  );
}
