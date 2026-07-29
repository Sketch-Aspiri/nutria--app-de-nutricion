'use client';

import { Check, Send, Smartphone } from 'lucide-react';

import { Btn } from '@/components/ui/Btn';
import { useInvitarPaciente } from '@/hooks/usePacientes';
import { ApiError, type AccesoAppApi } from '@/services/pacientes';

type InvitarAppProps = {
  pacienteId: string;
  acceso: AccesoAppApi | null;
};

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Acceso del paciente a su app: invitar, reinvitar o mostrar que ya entró.
 *
 * Los motivos de rechazo del servidor (sin correo, sin consentimiento, ya
 * vinculado) se muestran tal cual porque cada uno indica qué falta hacer; no se
 * anticipan en el cliente para no duplicar la regla.
 */
export function InvitarApp({ pacienteId, acceso }: InvitarAppProps) {
  const invitacion = useInvitarPaciente(pacienteId);

  if (!acceso) return null;

  if (acceso.cuenta_activa) {
    return (
      <div className="flex items-center gap-1.5 text-emerald-800 text-xs">
        <Check size={14} /> Usa la app
      </div>
    );
  }

  const pendiente = acceso.invitacion_pendiente;
  const error = invitacion.error instanceof ApiError ? invitacion.error.message : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Btn
        variant="outline"
        size="sm"
        disabled={invitacion.isPending}
        onClick={() => invitacion.mutate()}
      >
        {pendiente ? <Send size={14} /> : <Smartphone size={14} />}
        {invitacion.isPending
          ? 'Enviando…'
          : pendiente
            ? 'Reenviar invitación'
            : 'Invitar a la app'}
      </Btn>
      {error && <span className="text-red-700 text-xs max-w-64 text-right">{error}</span>}
      {!error && invitacion.isSuccess && (
        <span className="text-emerald-800 text-xs">Invitación enviada.</span>
      )}
      {!error && !invitacion.isSuccess && pendiente && (
        <span className="text-stone-400 text-xs">
          Invitación pendiente, vence el {fechaCorta(pendiente.expira_en)}
        </span>
      )}
    </div>
  );
}
