'use client';

import { Bell, BellOff, Check, Video, X } from 'lucide-react';

import { Btn } from '@/components/ui/Btn';
import {
  CLASE_ESTADO_CITA,
  ETIQUETA_ESTADO_CITA,
  ETIQUETA_TIPO_CITA,
  horaDeCita,
} from '@/domain/agendaFormato';
import type { CitaApi } from '@/services/agenda';

type FilaCitaProps = {
  cita: CitaApi;
  onCancelar: (id: string) => void;
  onCompletar: (id: string) => void;
  onAbrirVideo: (cita: CitaApi) => void;
  ocupada: boolean;
};

export function FilaCita({ cita, onCancelar, onCompletar, onAbrirVideo, ocupada }: FilaCitaProps) {
  const abierta = cita.estado === 'PROGRAMADA';

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-stone-200 bg-white p-4 ${
        abierta ? '' : 'opacity-70'
      }`}
      data-testid="fila-cita"
    >
      <div className="w-16 shrink-0 text-center">
        <div className="font-mono text-lg text-emerald-900">{horaDeCita(cita.inicio)}</div>
        <div className="text-[10px] text-stone-400">{cita.duracion_min} min</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-emerald-950">{cita.paciente.nombre}</div>
        <div className="text-xs text-stone-400">
          {ETIQUETA_TIPO_CITA[cita.tipo]}
          {cita.notas ? ` · ${cita.notas}` : ''}
        </div>
      </div>

      <span
        className={`rounded-full border px-2.5 py-1 text-xs ${CLASE_ESTADO_CITA[cita.estado]}`}
        data-testid="estado-cita"
      >
        {ETIQUETA_ESTADO_CITA[cita.estado]}
      </span>

      {/* El recordatorio es automático: esto informa si ya salió, no lo activa. */}
      <span
        className="flex items-center gap-1 text-[11px] text-stone-400"
        title={
          cita.recordatorio_enviado_at
            ? 'El recordatorio ya se envió al paciente'
            : 'Se enviará 24 horas antes de la cita'
        }
      >
        {cita.recordatorio_enviado_at ? <Bell size={12} /> : <BellOff size={12} />}
        {cita.recordatorio_enviado_at ? 'Recordado' : 'Pendiente'}
      </span>

      {cita.tipo === 'VIDEOLLAMADA' && (
        <Btn size="sm" variant="outline" onClick={() => onAbrirVideo(cita)}>
          <Video size={14} /> Videollamada
        </Btn>
      )}

      {abierta && (
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => onCompletar(cita.id)}
            disabled={ocupada}
            title="Marcar como completada"
            aria-label={`Completar cita de ${cita.paciente.nombre}`}
            className="text-emerald-800 hover:bg-emerald-50 rounded-lg p-2 disabled:opacity-50"
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={() => onCancelar(cita.id)}
            disabled={ocupada}
            title="Cancelar cita"
            aria-label={`Cancelar cita de ${cita.paciente.nombre}`}
            className="text-orange-700 hover:bg-orange-50 rounded-lg p-2 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
