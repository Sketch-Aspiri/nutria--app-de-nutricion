'use client';

import { useCallback, useState } from 'react';

import type { NotaConsulta, Paciente } from '@nutria/shared';

import { generarJSON } from '@/services/ia';
import { useAppState } from '@/store/app-state';

type NotaEstructurada = Omit<NotaConsulta, 'fecha'>;

/**
 * Convierte texto libre (notas o transcripción) en una nota clínica estructurada vía IA.
 * Si la IA falla, guarda el texto como nota libre para no perder el trabajo del nutriólogo.
 */
export function useNotaClinica(paciente: Paciente) {
  const { updatePatient } = useAppState();
  const [procesando, setProcesando] = useState(false);

  const procesar = useCallback(
    async (texto: string) => {
      if (!texto.trim()) return;
      setProcesando(true);
      const guardar = (nota: NotaEstructurada) =>
        updatePatient(paciente.id, (p) => ({
          notasConsulta: [
            { fecha: new Date().toLocaleDateString('es-MX'), ...nota },
            ...p.notasConsulta,
          ],
        }));
      try {
        const prompt = `Eres un asistente clínico para nutriólogos. Convierte estas notas/transcripción de consulta en un resumen clínico estructurado. Responde solo con JSON: {"motivo": string, "hallazgos": string, "plan": string, "seguimiento": string}.
Paciente: ${paciente.nombre}, objetivo: ${paciente.medico.objetivo}. Texto: ${texto}`;
        guardar(await generarJSON<NotaEstructurada>(prompt, 500));
      } catch {
        guardar({ motivo: 'Nota libre', hallazgos: texto, plan: '—', seguimiento: '—' });
      } finally {
        setProcesando(false);
      }
    },
    [paciente.id, paciente.nombre, paciente.medico.objetivo, updatePatient],
  );

  return { procesar, procesando };
}
