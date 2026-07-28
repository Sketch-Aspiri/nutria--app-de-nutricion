'use client';

import { Camera } from 'lucide-react';

import type { Genero, NivelActividad, Objetivo, Paciente } from '@nutria/shared';
import {
  ALERGIAS_COMUNES,
  CONDICIONES,
  NIVELES_ACTIVIDAD,
  OBJETIVOS,
  TIPOS_DIETA,
  edadDesdeFechaNacimiento,
} from '@nutria/shared';

import { AgregarOtro } from '@/components/ui/AgregarOtro';
import { Avatar } from '@/components/ui/Avatar';
import { Chip } from '@/components/ui/Chip';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';

/**
 * Campos del expediente compartidos por el alta (`NuevoPacienteWizard`) y la
 * edición (`EditarPacienteModal`). Viven juntos para que capturar y corregir
 * un paciente pidan exactamente los mismos datos con las mismas reglas.
 */

export type FormPaciente = {
  nombre: string;
  /** ISO `AAAA-MM-DD`. El expediente guarda la fecha, no la edad. */
  fechaNacimiento: string;
  genero: Genero;
  telefono: string;
  email: string;
  foto: string | null;
  condiciones: string[];
  antecedentes: string;
  medicamentos: string;
  nivelActividad: NivelActividad;
  objetivo: Objetivo;
  objetivoOtro: string;
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

export const FORM_PACIENTE_INICIAL: FormPaciente = {
  nombre: '', fechaNacimiento: '', genero: 'Femenino', telefono: '', email: '', foto: null,
  condiciones: [], antecedentes: '', medicamentos: '', nivelActividad: 'Moderado',
  objetivo: 'Pérdida de grasa', objetivoOtro: '',
  peso: '', altura: '', cintura: '', cadera: '',
  grasaCorporal: '', tipoDieta: 'Omnívoro', alergias: [], disgustos: '',
  comidasPorDia: '4', presupuestoTiempo: 'Medio',
};

/**
 * Espejo de los límites de `expedienteMedicoSchema` y `preferenciasSchema`:
 * cortar aquí evita que el servidor conteste 422 al guardar.
 */
export const MAX_CONDICIONES = 20;
export const MAX_ALERGIAS = 30;
export const MAX_LARGO_ETIQUETA = 80;
export const MAX_LARGO_DIETA = 60;
export const MAX_LARGO_OBJETIVO = 120;

/** Campo numérico opcional: vacío se envía como null, no como 0. */
export function numeroOpcional(valor: string): number | null {
  const numero = Number(valor);
  return valor.trim() !== '' && Number.isFinite(numero) && numero > 0 ? numero : null;
}

/** Un valor "sin capturar" del dominio (0 o vacío) vuelve al formulario en blanco. */
function textoDeNumero(valor: number | null | undefined): string {
  return valor ? valor.toString() : '';
}

/** El listado de dominio usa centinelas ('Ninguna') que no son datos capturados. */
function sinCentinela(valores: string[]): string[] {
  return valores.filter((valor) => valor !== 'Ninguna');
}

/** Precarga el formulario con el expediente vigente para editarlo. */
export function formDesdePaciente(paciente: Paciente): FormPaciente {
  return {
    nombre: paciente.nombre,
    fechaNacimiento: paciente.fechaNacimiento?.slice(0, 10) ?? '',
    genero: paciente.genero,
    telefono: paciente.telefono,
    email: paciente.email,
    foto: paciente.foto,
    condiciones: sinCentinela(paciente.medico.condiciones),
    antecedentes: paciente.medico.antecedentes,
    medicamentos: paciente.medico.medicamentos,
    nivelActividad: paciente.medico.nivelActividad,
    objetivo: paciente.medico.objetivo,
    objetivoOtro: paciente.medico.objetivoOtro ?? '',
    peso: textoDeNumero(paciente.antropometria.peso),
    altura: textoDeNumero(paciente.antropometria.altura),
    cintura: textoDeNumero(paciente.antropometria.cintura),
    cadera: textoDeNumero(paciente.antropometria.cadera),
    grasaCorporal: textoDeNumero(paciente.antropometria.grasaCorporal),
    tipoDieta: paciente.preferencias.tipoDieta,
    alergias: sinCentinela(paciente.preferencias.alergias),
    disgustos: paciente.preferencias.disgustos,
    comidasPorDia: paciente.preferencias.comidasPorDia.toString(),
    presupuestoTiempo: paciente.preferencias.presupuestoTiempo,
  };
}

type CamposProps = {
  form: FormPaciente;
  set: <Clave extends keyof FormPaciente>(clave: Clave, valor: FormPaciente[Clave]) => void;
};

const CAMPOS_ANTROPOMETRIA = [
  ['peso', 'Peso (kg)'],
  ['altura', 'Altura (cm)'],
  ['cintura', 'Cintura (cm)'],
  ['cadera', 'Cadera (cm)'],
  ['grasaCorporal', '% grasa (opcional)'],
] as const;

function alternar(valores: string[], valor: string): string[] {
  return valores.includes(valor) ? valores.filter((x) => x !== valor) : [...valores, valor];
}

export function CamposDatosGenerales({ form, set }: CamposProps) {
  const edad = edadDesdeFechaNacimiento(form.fechaNacimiento || null);

  const subirFoto = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => set('foto', typeof lector.result === 'string' ? lector.result : null);
    lector.readAsDataURL(archivo);
  };

  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        <Avatar foto={form.foto} nombre={form.nombre || '?'} size={64} />
        <label className="flex items-center gap-2 text-xs text-emerald-800 border border-emerald-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-emerald-50">
          <Camera size={14} /> Subir foto
          <input type="file" accept="image/*" className="hidden" onChange={subirFoto} />
        </label>
      </div>
      <div>
        <label className={lbl} htmlFor="paciente-nombre">Nombre completo</label>
        <input id="paciente-nombre" className={inp} value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej. Ana López" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl} htmlFor="paciente-fecha-nacimiento">Fecha de nacimiento</label>
          <input
            id="paciente-fecha-nacimiento"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            className={inp}
            value={form.fechaNacimiento}
            onChange={(e) => set('fechaNacimiento', e.target.value)}
          />
          {/* El cálculo de gasto energético necesita la edad: se muestra al capturar. */}
          <div className="text-xs text-stone-400 mt-1">
            {edad > 0 ? `${edad} años` : 'Necesaria para calcular el gasto energético'}
          </div>
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
  );
}

export function CamposExpedienteMedico({ form, set }: CamposProps) {
  // Lo que el nutriólogo escribió: se separa del catálogo para poder quitarlo.
  const condicionesPropias = form.condiciones.filter((c) => !CONDICIONES.includes(c));

  return (
    <>
      <div>
        <label className={lbl}>Condiciones médicas</label>
        <div className="flex flex-wrap gap-2">
          {CONDICIONES.map((c) => (
            <Chip key={c} label={c} active={form.condiciones.includes(c)} onClick={() => set('condiciones', alternar(form.condiciones, c))} />
          ))}
          {condicionesPropias.map((c) => (
            <Chip key={c} label={c} active removable onClick={() => set('condiciones', alternar(form.condiciones, c))} />
          ))}
        </div>
        <AgregarOtro
          id="paciente-otra-condicion"
          placeholder="Otra condición (p. ej. SOP)"
          maxLength={MAX_LARGO_ETIQUETA}
          existentes={form.condiciones}
          habilitado={form.condiciones.length < MAX_CONDICIONES}
          onAgregar={(valor) => set('condiciones', [...form.condiciones, valor])}
        />
        {form.condiciones.length >= MAX_CONDICIONES && (
          <div className="text-stone-500 text-xs mt-1.5">
            Llegaste al máximo de {MAX_CONDICIONES} condiciones.
          </div>
        )}
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
      {form.objetivo === 'Otro' && (
        <div>
          <label className={lbl} htmlFor="paciente-objetivo-otro">¿Cuál es el objetivo?</label>
          <input
            id="paciente-objetivo-otro"
            className={inp}
            placeholder="p. ej. Recuperación post cirugía bariátrica"
            maxLength={MAX_LARGO_OBJETIVO}
            value={form.objetivoOtro}
            onChange={(e) => set('objetivoOtro', e.target.value)}
          />
        </div>
      )}
    </>
  );
}

export function CamposAntropometria({ form, set }: CamposProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CAMPOS_ANTROPOMETRIA.map(([campo, etiqueta]) => (
        <div key={campo}>
          <label className={lbl} htmlFor={`paciente-${campo}`}>{etiqueta}</label>
          <input id={`paciente-${campo}`} type="number" className={inp} value={form[campo]} onChange={(e) => set(campo, e.target.value)} />
        </div>
      ))}
    </div>
  );
}

export function CamposPreferencias({ form, set }: CamposProps) {
  const alergiasPropias = form.alergias.filter((a) => !ALERGIAS_COMUNES.includes(a));
  const dietaPropia = TIPOS_DIETA.includes(form.tipoDieta) ? null : form.tipoDieta;

  return (
    <>
      <div>
        <label className={lbl}>Tipo de dieta</label>
        <div className="flex flex-wrap gap-2">
          {TIPOS_DIETA.map((t) => (
            <Chip key={t} label={t} active={form.tipoDieta === t} onClick={() => set('tipoDieta', t)} />
          ))}
          {dietaPropia && (
            // El tipo de dieta es uno solo: quitarlo devuelve al valor por defecto.
            <Chip label={dietaPropia} active removable onClick={() => set('tipoDieta', FORM_PACIENTE_INICIAL.tipoDieta)} />
          )}
        </div>
        <AgregarOtro
          id="paciente-otra-dieta"
          placeholder="Otro tipo de dieta (p. ej. Baja en FODMAP)"
          maxLength={MAX_LARGO_DIETA}
          existentes={TIPOS_DIETA}
          onAgregar={(valor) => set('tipoDieta', valor)}
        />
      </div>
      <div>
        <label className={lbl}>Alergias / intolerancias</label>
        <div className="flex flex-wrap gap-2">
          {ALERGIAS_COMUNES.map((a) => (
            <Chip key={a} label={a} active={form.alergias.includes(a)} onClick={() => set('alergias', alternar(form.alergias, a))} />
          ))}
          {alergiasPropias.map((a) => (
            <Chip key={a} label={a} active removable onClick={() => set('alergias', alternar(form.alergias, a))} />
          ))}
        </div>
        <AgregarOtro
          id="paciente-otra-alergia"
          placeholder="Otra alergia o intolerancia (p. ej. Fructosa)"
          maxLength={MAX_LARGO_ETIQUETA}
          existentes={form.alergias}
          habilitado={form.alergias.length < MAX_ALERGIAS}
          onAgregar={(valor) => set('alergias', [...form.alergias, valor])}
        />
        {form.alergias.length >= MAX_ALERGIAS && (
          <div className="text-stone-500 text-xs mt-1.5">
            Llegaste al máximo de {MAX_ALERGIAS} alergias.
          </div>
        )}
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
  );
}
