'use client';

import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { useArchivarPaciente } from '@/hooks/usePacientes';

type ConfirmarBajaPacienteProps = {
  paciente: { id: string; nombre: string };
  onClose: () => void;
  /** Se invoca solo cuando el servidor confirmó la baja. */
  onArchivado?: (id: string) => void;
};

/**
 * Confirmación de baja. Se pide de forma explícita porque la acción saca al
 * paciente del listado; el expediente clínico no se borra (ver `archivarPaciente`).
 */
export function ConfirmarBajaPaciente({
  paciente,
  onClose,
  onArchivado,
}: ConfirmarBajaPacienteProps) {
  const archivar = useArchivarPaciente();

  const confirmar = async () => {
    try {
      await archivar.mutateAsync(paciente.id);
      onArchivado?.(paciente.id);
      onClose();
    } catch {
      // El estado de error de la mutación ya se muestra abajo.
    }
  };

  return (
    <Modal>
      <div className="p-4 sm:p-6">
        <ModalHeader title="Eliminar paciente" onClose={onClose} />
        <p className="text-sm text-stone-600 leading-relaxed">
          Vas a eliminar a <span className="font-medium text-emerald-950">{paciente.nombre}</span>{' '}
          de tu lista de pacientes activos.
        </p>
        <p className="text-sm text-stone-500 leading-relaxed mt-3">
          Su expediente clínico se conserva archivado, como exige la normativa. Dejarás de verlo en
          tu panel y no podrás registrarle nuevas consultas.
        </p>

        {archivar.isError && (
          <div
            role="alert"
            className="mt-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-3 py-2.5"
          >
            No pudimos eliminar al paciente. Revisa tu conexión e inténtalo de nuevo.
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Btn variant="ghost" disabled={archivar.isPending} onClick={onClose}>
            Cancelar
          </Btn>
          <Btn variant="danger" disabled={archivar.isPending} onClick={() => void confirmar()}>
            {archivar.isPending ? 'Eliminando…' : 'Eliminar paciente'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
