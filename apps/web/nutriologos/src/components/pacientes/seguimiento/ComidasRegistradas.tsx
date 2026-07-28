'use client';

import { Check, Loader2, Utensils } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SectionCard } from '@/components/ui/SectionCard';
import { useComentarComida } from '@/hooks/useSeguimiento';
import type { ComidaRegistradaApi } from '@/services/seguimiento';

const FECHA = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

type Props = {
  pacienteId: string;
  comidas: ComidaRegistradaApi[];
};

export function ComidasRegistradas({ pacienteId, comidas }: Props) {
  return (
    <SectionCard title="Comidas registradas por el paciente" icon={Utensils}>
      {comidas.length === 0 && (
        <div className="text-sm text-stone-400">
          Aún no hay comidas registradas. Aparecerán aquí cuando el paciente las capture desde
          la app.
        </div>
      )}
      <div className="space-y-3">
        {comidas.map((comida) => (
          <ComidaConComentario key={comida.id} pacienteId={pacienteId} comida={comida} />
        ))}
      </div>
    </SectionCard>
  );
}

/**
 * El comentario se guarda al salir del campo, no en cada tecla: escribir una
 * línea dispararía una petición por letra.
 */
function ComidaConComentario({
  pacienteId,
  comida,
}: {
  pacienteId: string;
  comida: ComidaRegistradaApi;
}) {
  const [borrador, setBorrador] = useState(comida.comentario_nutriologo ?? '');
  const comentar = useComentarComida(pacienteId);

  // Si el registro cambia por debajo (otro dispositivo, refetch), el campo
  // sigue al servidor mientras no se esté editando.
  useEffect(() => {
    setBorrador(comida.comentario_nutriologo ?? '');
  }, [comida.comentario_nutriologo]);

  const guardar = () => {
    const limpio = borrador.trim();
    if (limpio === (comida.comentario_nutriologo ?? '')) return;
    comentar.mutate({ comidaId: comida.id, comentario: limpio || null });
  };

  return (
    <div
      className="flex items-start gap-3 border-t border-stone-100 pt-3 first:border-0 first:pt-0"
      data-testid="comida-registrada"
    >
      {comida.foto_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={comida.foto_url}
          alt=""
          className="w-12 h-12 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
          <Utensils size={16} className="text-stone-400" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="text-sm text-emerald-950 font-medium">{comida.nombre}</div>
        <div className="text-xs text-stone-400">{FECHA.format(new Date(comida.fecha))}</div>
        {comida.comentario_paciente && (
          <div className="text-xs text-stone-500 italic mt-0.5">
            “{comida.comentario_paciente}”
          </div>
        )}

        <div className="flex items-center gap-2 mt-1">
          <input
            placeholder="Añadir comentario para el paciente..."
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onBlur={guardar}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            aria-label={`Comentario sobre ${comida.nombre}`}
            className="text-xs flex-1 border-b border-stone-200 focus:outline-none focus:border-emerald-400 pb-0.5 bg-transparent"
          />
          {comentar.isPending && <Loader2 size={12} className="animate-spin text-stone-400" />}
          {comentar.isSuccess && !comentar.isPending && (
            <Check size={12} className="text-lime-600" />
          )}
        </div>
        {comentar.isError && (
          <div className="text-orange-600 text-[11px] mt-1">
            No pudimos guardar el comentario.
          </div>
        )}
      </div>
    </div>
  );
}
