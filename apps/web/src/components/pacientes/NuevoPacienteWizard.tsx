'use client';

import { Camera, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { Genero, NivelActividad, Objetivo } from '@nutria/shared';
import {
  ALERGIAS_COMUNES,
  CONDICIONES,
  NIVELES_ACTIVIDAD,
  OBJETIVOS,
  TIPOS_DIETA,
  fechaNacimientoDesdeEdad,
  generoADb,
  nivelActividadADb,
  objetivoADb,
} from '@nutria/shared';

import { Avatar } from '@/components/ui/Avatar';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';
import { useCrearPaciente } from '@/hooks/usePacientes';
import { ApiError, type CrearPacientePayload } from '@/services/pacientes';

type FormPaciente = {
  nombre: string;
  edad: string;
  genero: Genero;
  telefono: string;
  email: string;
  foto: string | null;
  condiciones: string[];
  antecedentes: string;
  medicamentos: string;
  nivelActividad: NivelActividad;
  objetivo: Objetivo;
  peso: string;
  altura: string;
  cintura: string;
  cadera: string;
  grasaCorporal: string;
  tipoDieta: string;
  alergias: string[];
  disgustos: string;
  comidasPorDia: string;
  presupuestoTiempo: 'Bajo' | 'Medio' | 'Alto';
};

const FORM_INICIAL: FormPaciente = {
  nombre: '', edad: '', genero: 'Femenino', telefono: '', email: '', foto: null,
  condiciones: [], antecedentes: '', medicamentos: '', nivelActividad: 'Moderado',
  objetivo: 'Pérdida de grasa', peso: '', altura: '', cintura: '', cadera: '',
  grasaCorporal: '', tipoDieta: 'Omnívoro', alergias: [], disgustos: '',
  comidasPorDia: '4', presupuestoTiempo: 'Medio',
};

const PASOS = ['Datos generales', 'Expediente médico', 'Antropometría', 'Preferencias alimentarias'];

/** Campo numérico opcional: vacío se envía como null, no como 0. */
function numeroOpcional(valor: string): number | null {
  const numero = Number(valor);
  return valor.trim() !== '' && Number.isFinite(numero) && numero > 0 ? numero : null;
}

export function construirPayload(form: FormPaciente): CrearPacientePayload {
  return {
    nombre: form.nombre.trim(),
    // El expediente guarda fecha de nacimiento; la edad capturada se convierte.
    fecha_nacimiento: fechaNacimientoDesdeEdad(Number(form.edad)),
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
  };
}

type NuevoPacienteWizardProps = {
  onClose: () => void;
  onCreado: (id: string) => void;
};

export function NuevoPacienteWizard({ onClose, onCreado }: NuevoPacienteWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormPaciente>(FORM_INICIAL);
  const [error, setError] = useState('');
  const crear = useCrearPaciente();

  const guardar = async () => {
    setError('');
    try {
      const paciente = await crear.mutateAsync(construirPayload(form));
      onCreado(paciente.id);
    } catch (fallo: unknown) {
      setError(
        fallo instanceof ApiError
          ? fallo.message
          : 'No pudimos guardar al paciente. Intenta de nuevo.',
      );
      // El expediente se captura en el paso 0: ahí se ven los errores de datos.
      if (fallo instanceof ApiError && fallo.details?.nombre) setStep(0);
    }
  };
  const set = <K extends keyof FormPaciente>(k: K, v: FormPaciente[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const toggleList = (k: 'condiciones' | 'alergias', val: string) =>
    setForm((f) => ({
      ...f,
      [k]: f[k].includes(val) ? f[k].filter((x) => x !== val) : [...f[k], val],
    }));
  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => set('foto', typeof r.result === 'string' ? r.result : null);
    r.readAsDataURL(file);
  };

  return (
    <Modal>
      <div className="p-6 pb-0">
        <ModalHeader title="Nuevo paciente" onClose={onClose} />
        <div className="flex gap-1.5 mb-5">
          {PASOS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-emerald-800' : 'bg-stone-200'}`} />
          ))}
        </div>
        <div className="text-xs uppercase tracking-wide text-stone-400 mb-4">{PASOS[step]}</div>
      </div>
      <div className="px-6 space-y-3">
        {step === 0 && (
          <>
            <div className="flex items-center gap-4 mb-2">
              <Avatar foto={form.foto} nombre={form.nombre || '?'} size={64} />
              <label className="flex items-center gap-2 text-xs text-emerald-800 border border-emerald-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-emerald-50">
                <Camera size={14} /> Subir foto
                <input type="file" accept="image/*" className="hidden" onChange={handleFoto} />
              </label>
            </div>
            <div>
              <label className={lbl} htmlFor="paciente-nombre">Nombre completo</label>
              <input id="paciente-nombre" className={inp} value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej. Ana López" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl} htmlFor="paciente-edad">Edad</label>
                <input id="paciente-edad" type="number" className={inp} value={form.edad} onChange={(e) => set('edad', e.target.value)} />
              </div>
              <div>
                <label className={lbl} htmlFor="paciente-genero">Género</label>
                <select id="paciente-genero" className={inp} value={form.genero} onChange={(e) => set('genero', e.target.value as Genero)}>
                  <option>Femenino</option>
                  <option>Masculino</option>
                  <option>Otro</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl} htmlFor="paciente-telefono">Teléfono</label>
                <input id="paciente-telefono" className={inp} value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
              </div>
              <div>
                <label className={lbl} htmlFor="paciente-email">Email</label>
                <input id="paciente-email" className={inp} value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div>
              <label className={lbl}>Condiciones médicas</label>
              <div className="flex flex-wrap gap-2">
                {CONDICIONES.map((c) => (
                  <Chip key={c} label={c} active={form.condiciones.includes(c)} onClick={() => toggleList('condiciones', c)} />
                ))}
              </div>
            </div>
            <div>
              <label className={lbl} htmlFor="paciente-antecedentes">Antecedentes relevantes</label>
              <textarea id="paciente-antecedentes" rows={2} className={inp} value={form.antecedentes} onChange={(e) => set('antecedentes', e.target.value)} />
            </div>
            <div>
              <label className={lbl} htmlFor="paciente-medicamentos">Medicamentos actuales</label>
              <input id="paciente-medicamentos" className={inp} value={form.medicamentos} onChange={(e) => set('medicamentos', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl} htmlFor="paciente-actividad">Nivel de actividad</label>
                <select id="paciente-actividad" className={inp} value={form.nivelActividad} onChange={(e) => set('nivelActividad', e.target.value as NivelActividad)}>
                  {NIVELES_ACTIVIDAD.map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="paciente-objetivo">Objetivo</label>
                <select id="paciente-objetivo" className={inp} value={form.objetivo} onChange={(e) => set('objetivo', e.target.value as Objetivo)}>
                  {OBJETIVOS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['peso', 'Peso (kg)'],
                ['altura', 'Altura (cm)'],
                ['cintura', 'Cintura (cm)'],
                ['cadera', 'Cadera (cm)'],
                ['grasaCorporal', '% grasa (opcional)'],
              ] as const
            ).map(([campo, etiqueta]) => (
              <div key={campo}>
                <label className={lbl} htmlFor={`paciente-${campo}`}>{etiqueta}</label>
                <input id={`paciente-${campo}`} type="number" className={inp} value={form[campo]} onChange={(e) => set(campo, e.target.value)} />
              </div>
            ))}
          </div>
        )}
        {step === 3 && (
          <>
            <div>
              <label className={lbl}>Tipo de dieta</label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_DIETA.map((t) => (
                  <Chip key={t} label={t} active={form.tipoDieta === t} onClick={() => set('tipoDieta', t)} />
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Alergias / intolerancias</label>
              <div className="flex flex-wrap gap-2">
                {ALERGIAS_COMUNES.map((a) => (
                  <Chip key={a} label={a} active={form.alergias.includes(a)} onClick={() => toggleList('alergias', a)} />
                ))}
              </div>
            </div>
            <div>
              <label className={lbl} htmlFor="paciente-disgustos">Alimentos que no le gustan</label>
              <input id="paciente-disgustos" className={inp} value={form.disgustos} onChange={(e) => set('disgustos', e.target.value)} placeholder="Ej. cilantro, hígado" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl} htmlFor="paciente-comidas">Comidas al día</label>
                <input id="paciente-comidas" type="number" className={inp} value={form.comidasPorDia} onChange={(e) => set('comidasPorDia', e.target.value)} />
              </div>
              <div>
                <label className={lbl} htmlFor="paciente-tiempo">Tiempo para cocinar</label>
                <select id="paciente-tiempo" className={inp} value={form.presupuestoTiempo} onChange={(e) => set('presupuestoTiempo', e.target.value as FormPaciente['presupuestoTiempo'])}>
                  <option>Bajo</option>
                  <option>Medio</option>
                  <option>Alto</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-3 py-2.5"
        >
          {error}
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
          <Btn disabled={crear.isPending} onClick={() => void guardar()}>
            {crear.isPending ? 'Guardando…' : 'Crear paciente'}
          </Btn>
        )}
      </div>
    </Modal>
  );
}
