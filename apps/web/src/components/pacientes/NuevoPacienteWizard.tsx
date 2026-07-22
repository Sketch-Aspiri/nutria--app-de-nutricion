'use client';

import { Camera, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { Genero, NivelActividad, Objetivo, Paciente } from '@nutria/shared';
import {
  ALERGIAS_COMUNES,
  CONDICIONES,
  NIVELES_ACTIVIDAD,
  OBJETIVOS,
  TIPOS_DIETA,
} from '@nutria/shared';

import { Avatar } from '@/components/ui/Avatar';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';

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

function construirPaciente(form: FormPaciente): Paciente {
  return {
    id: Date.now(),
    nombre: form.nombre || 'Nuevo paciente',
    foto: form.foto,
    edad: Number(form.edad) || 0,
    genero: form.genero,
    telefono: form.telefono,
    email: form.email,
    medico: {
      condiciones: form.condiciones.length ? form.condiciones : ['Ninguna'],
      antecedentes: form.antecedentes,
      medicamentos: form.medicamentos,
      nivelActividad: form.nivelActividad,
      objetivo: form.objetivo,
    },
    antropometria: {
      peso: Number(form.peso) || 0,
      altura: Number(form.altura) || 0,
      cintura: Number(form.cintura) || 0,
      cadera: Number(form.cadera) || 0,
      grasaCorporal: Number(form.grasaCorporal) || 0,
      historial: [{ fecha: 'Hoy', peso: Number(form.peso) || 0 }],
    },
    preferencias: {
      tipoDieta: form.tipoDieta,
      alergias: form.alergias.length ? form.alergias : ['Ninguna'],
      disgustos: form.disgustos,
      comidasPorDia: Number(form.comidasPorDia) || 4,
      presupuestoTiempo: form.presupuestoTiempo,
    },
    calculo: null,
    planActivo: null,
    planEjercicio: null,
    notasConsulta: [],
    seguimiento: { adherencia: 0, racha: 0, comidas: [], ejercicio: [], recetasEnCurso: [], recetasSugeridas: [] },
  };
}

type NuevoPacienteWizardProps = {
  onClose: () => void;
  onCrear: (p: Paciente) => void;
};

export function NuevoPacienteWizard({ onClose, onCrear }: NuevoPacienteWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormPaciente>(FORM_INICIAL);
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
              <label className={lbl}>Nombre completo</label>
              <input className={inp} value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej. Ana López" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Edad</label>
                <input type="number" className={inp} value={form.edad} onChange={(e) => set('edad', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Género</label>
                <select className={inp} value={form.genero} onChange={(e) => set('genero', e.target.value as Genero)}>
                  <option>Femenino</option>
                  <option>Masculino</option>
                  <option>Otro</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Teléfono</label>
                <input className={inp} value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input className={inp} value={form.email} onChange={(e) => set('email', e.target.value)} />
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
              <label className={lbl}>Antecedentes relevantes</label>
              <textarea rows={2} className={inp} value={form.antecedentes} onChange={(e) => set('antecedentes', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Medicamentos actuales</label>
              <input className={inp} value={form.medicamentos} onChange={(e) => set('medicamentos', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Nivel de actividad</label>
                <select className={inp} value={form.nivelActividad} onChange={(e) => set('nivelActividad', e.target.value as NivelActividad)}>
                  {NIVELES_ACTIVIDAD.map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Objetivo</label>
                <select className={inp} value={form.objetivo} onChange={(e) => set('objetivo', e.target.value as Objetivo)}>
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
                <label className={lbl}>{etiqueta}</label>
                <input type="number" className={inp} value={form[campo]} onChange={(e) => set(campo, e.target.value)} />
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
              <label className={lbl}>Alimentos que no le gustan</label>
              <input className={inp} value={form.disgustos} onChange={(e) => set('disgustos', e.target.value)} placeholder="Ej. cilantro, hígado" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Comidas al día</label>
                <input type="number" className={inp} value={form.comidasPorDia} onChange={(e) => set('comidasPorDia', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Tiempo para cocinar</label>
                <select className={inp} value={form.presupuestoTiempo} onChange={(e) => set('presupuestoTiempo', e.target.value as FormPaciente['presupuestoTiempo'])}>
                  <option>Bajo</option>
                  <option>Medio</option>
                  <option>Alto</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="flex justify-between p-6 pt-5">
        <Btn variant="ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
          {step === 0 ? 'Cancelar' : 'Atrás'}
        </Btn>
        {step < PASOS.length - 1 ? (
          <Btn onClick={() => setStep(step + 1)}>
            Siguiente <ChevronRight size={15} />
          </Btn>
        ) : (
          <Btn onClick={() => onCrear(construirPaciente(form))}>Crear paciente</Btn>
        )}
      </div>
    </Modal>
  );
}
