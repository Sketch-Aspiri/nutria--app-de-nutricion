'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type { Paciente } from '@nutria/shared';

import {
  crearNotaClinica,
  firmarNotaClinica,
  listarNotasClinicas,
  type NuevaNotaClinica,
} from '@/services/consultas';
import { generarIA } from '@/services/ia';

type NotaEstructurada = Pick<
  NuevaNotaClinica,
  'motivo' | 'hallazgos' | 'plan' | 'seguimiento'
>;

/**
 * Estructura una nota con IA y siempre la persiste cifrada en PostgreSQL.
 *
 * Si el proveedor falla, conserva el texto como nota manual. Las copias en
 * localStorage se eliminaron: un navegador compartido no debe guardar PHI.
 */
export function useNotaClinica(paciente: Paciente) {
  const queryClient = useQueryClient();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryKey = ['consultation-notes', paciente.id] as const;

  const notes = useQuery({
    queryKey,
    queryFn: () => listarNotasClinicas(paciente.id),
  });

  const save = useMutation({
    mutationFn: (input: NuevaNotaClinica) =>
      crearNotaClinica(paciente.id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const sign = useMutation({
    mutationFn: (noteId: string) =>
      firmarNotaClinica(paciente.id, noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const procesar = useCallback(
    async (texto: string) => {
      if (!texto.trim()) return;
      setProcesando(true);
      setError(null);

      const guardar = (
        nota: NotaEstructurada,
        origen: NuevaNotaClinica['origen'],
      ) => save.mutateAsync({ ...nota, origen });

      try {
        const salida = await generarIA<NotaEstructurada>({
          tipo: 'NOTA_CLINICA',
          patient_id: paciente.id,
          texto,
        });
        if (salida.formato === 'estructurado' && salida.datos) {
          await guardar(salida.datos, 'IA');
        } else {
          await guardar(
            {
              motivo: 'Nota sin estructurar',
              hallazgos: salida.texto?.trim() || texto,
              plan: '—',
              seguimiento: '—',
            },
            'MANUAL',
          );
          setError(
            'La IA no pudo estructurar la nota. Se guardó cifrada como nota libre.',
          );
        }
      } catch {
        try {
          await guardar(
            {
              motivo: 'Nota libre',
              hallazgos: texto,
              plan: '—',
              seguimiento: '—',
            },
            'MANUAL',
          );
          setError(
            'La IA no respondió. La nota se guardó cifrada como texto libre.',
          );
        } catch (saveError: unknown) {
          setError(
            saveError instanceof Error
              ? saveError.message
              : 'No se pudo guardar la nota clínica.',
          );
        }
      } finally {
        setProcesando(false);
      }
    },
    [paciente.id, save],
  );

  return {
    procesar,
    procesando,
    error,
    notas: notes.data?.data ?? [],
    cargando: notes.isLoading,
    firmar: sign.mutateAsync,
    firmando: sign.isPending,
  };
}
