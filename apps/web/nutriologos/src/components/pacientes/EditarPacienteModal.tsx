'use client';

import { useState } from 'react';

import type { Paciente } from '@nutria/shared';
import { generoADb, nivelActividadADb, objetivoADb } from '@nutria/shared';

import {
  CamposAntropometria,
  CamposDatosGenerales,
  CamposExpedienteMedico,
  CamposPreferencias,
  type FormPaciente,
  formDesdePaciente,
  numeroOpcional,
} from '@/components/pacientes/camposPaciente';
import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { type EdicionPaciente, useEditarPaciente } from '@/hooks/usePacientes';
import { ApiError, type MedicionPayload } from '@/services/pacientes';

const SECCIONES = [
  { id: 'generales', titulo: 'Datos generales', Campos: CamposDatosGenerales },
  { id: 'medico', titulo: 'Expediente médico', Campos: CamposExpedienteMedico },
  { id: 'antropometria', titulo: 'Antropometría', Campos: CamposAntropometria },
  { id: 'preferencias', titulo: 'Preferencias alimentarias', Campos: CamposPreferencias },
] as const;

function medicionDesde(form: FormPaciente, paciente: Paciente): MedicionPayload {
  return {
    peso_kg: numeroOpcional(form.peso),
    altura_cm: numeroOpcional(form.altura),
    cintura_cm: numeroOpcional(form.cintura),
    cadera_cm: numeroOpcional(form.cadera),
    grasa_pct: numeroOpcional(form.grasaCorporal),
    // Los pliegues no se capturan aquí: se arrastran para que la toma nueva no
    // deje al paciente sin plicometría vigente.
    pliegues: paciente.antropometria.pliegues,
  };
}

function hayCambioDeMedidas(nueva: MedicionPayload, paciente: Paciente): boolean {
  const vigente = paciente.antropometria;
  return (
    nueva.peso_kg !== (vigente.peso || null) ||
    nueva.altura_cm !== (vigente.altura || null) ||
    nueva.cintura_cm !== (vigente.cintura || null) ||
    nueva.cadera_cm !== (vigente.cadera || null) ||
    nueva.grasa_pct !== (vigente.grasaCorporal || null)
  );
}

export function construirEdicion(form: FormPaciente, paciente: Paciente): EdicionPaciente {
  const medicion = medicionDesde(form, paciente);

  return {
    generales: {
      nombre: form.nombre.trim(),
      fecha_nacimiento: form.fechaNacimiento || null,
      genero: generoADb(form.genero),
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      foto_url: form.foto,
    },
    expediente: {
      condiciones: form.condiciones,
      antecedentes: form.antecedentes.trim() || null,
      medicamentos: form.medicamentos.trim() || null,
      nivel_actividad: nivelActividadADb(form.nivelActividad),
      objetivo: objetivoADb(form.objetivo),
      objetivo_otro: form.objetivoOtro.trim() || null,
    },
    preferencias: {
      tipo_dieta: form.tipoDieta,
      alergias: form.alergias,
      disgustos: form.disgustos.trim() || null,
      comidas_por_dia: Number(form.comidasPorDia) || 3,
      presupuesto_tiempo: form.presupuestoTiempo,
    },
    // Una toma de medidas es un registro fechado: solo se agrega si cambió algo.
    medicion: hayCambioDeMedidas(medicion, paciente) ? medicion : null,
  };
}

type Props = {
  paciente: Paciente;
  onClose: () => void;
};

/**
 * Edición del expediente completo en una sola pantalla.
 *
 * A diferencia del alta, aquí no hay pasos: quien corrige un dato ya sabe cuál
 * busca y encadenar cuatro pantallas solo lo estorbaría.
 */
export function EditarPacienteModal({ paciente, onClose }: Props) {
  const [form, setForm] = useState<FormPaciente>(() => formDesdePaciente(paciente));
  const editar = useEditarPaciente(paciente.id);

  const set = <Clave extends keyof FormPaciente>(clave: Clave, valor: FormPaciente[Clave]) =>
    setForm((previo) => ({ ...previo, [clave]: valor }));

  const guardar = () =>
    editar.mutate(construirEdicion(form, paciente), { onSuccess: onClose });

  return (
    <Modal wide>
      <div className="p-6 pb-0">
        <ModalHeader title="Editar paciente" onClose={onClose} />
      </div>
      <div className="px-6 space-y-6">
        {SECCIONES.map(({ id, titulo, Campos }) => (
          <section key={id} className="space-y-3">
            <h2 className="text-xs uppercase tracking-wide text-stone-400">{titulo}</h2>
            <Campos form={form} set={set} />
          </section>
        ))}
      </div>
      {editar.error && (
        <div
          role="alert"
          className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-3 py-2.5"
        >
          {editar.error instanceof ApiError
            ? editar.error.message
            : 'No pudimos guardar los cambios. Intenta de nuevo.'}
        </div>
      )}
      <div className="flex justify-between p-6 pt-5">
        <Btn variant="ghost" disabled={editar.isPending} onClick={onClose}>
          Cancelar
        </Btn>
        <Btn disabled={editar.isPending} onClick={guardar}>
          {editar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Btn>
      </div>
    </Modal>
  );
}
