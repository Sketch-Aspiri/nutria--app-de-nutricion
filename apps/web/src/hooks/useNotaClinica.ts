'use client';

import { useCallback, useState } from 'react';

import type { NotaConsulta, Paciente } from '@nutria/shared';

import { generarIA } from '@/services/ia';
import { useAppState } from '@/store/app-state';

type NotaEstructurada = Omit<NotaConsulta, 'fecha'>;

/**
 * Convierte texto libre (notas o dictado) en una nota clínica estructurada.
 *
 * El texto se manda tal cual al servidor, que lo seudonimiza antes de armar el
 * prompt: una nota dictada casi siempre menciona al paciente por su nombre.
 *
 * Si la IA falla o su salida no valida, se guarda el texto como nota libre: el
 * trabajo del nutriólogo no se pierde por un error del proveedor.
 */
export function useNotaClinica(paciente: Paciente) {
  const { updatePatient } = useAppState();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const procesar = useCallback(
    async (texto: string) => {
      if (!texto.trim()) return;
      setProcesando(true);
      setError(null);

      const guardar = (nota: NotaEstructurada) =>
        updatePatient(paciente.id, (p) => ({
          notasConsulta: [
            { fecha: new Date().toLocaleDateString('es-MX'), ...nota },
            ...p.notasConsulta,
          ],
        }));

      try {
        const salida = await generarIA<NotaEstructurada>({
          tipo: 'NOTA_CLINICA',
          patient_id: paciente.id,
          texto,
        });
        if (salida.formato === 'estructurado' && salida.datos) {
          guardar(salida.datos);
        } else {
          // Degradada a texto: se conserva lo que devolvió la IA y se avisa
          // para que el nutriólogo la acomode a mano.
          guardar({
            motivo: 'Nota sin estructurar',
            hallazgos: salida.texto?.trim() || texto,
            plan: '—',
            seguimiento: '—',
          });
          setError('La IA no pudo estructurar la nota. Se guardó como nota libre para editarla.');
        }
      } catch (fallo: unknown) {
        guardar({ motivo: 'Nota libre', hallazgos: texto, plan: '—', seguimiento: '—' });
        setError(
          fallo instanceof Error
            ? fallo.message
            : 'No se pudo contactar al asistente. La nota se guardó sin estructurar.',
        );
      } finally {
        setProcesando(false);
      }
    },
    [paciente.id, updatePatient],
  );

  return { procesar, procesando, error };
}
