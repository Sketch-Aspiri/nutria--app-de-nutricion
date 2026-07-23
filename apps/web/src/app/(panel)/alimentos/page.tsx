'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { AlimentoFicha } from '@nutria/shared';

import { BuscadorAlimentos } from '@/components/alimentos/BuscadorAlimentos';
import { FormAlimento } from '@/components/alimentos/FormAlimento';
import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import {
  useActualizarAlimento,
  useArchivarAlimento,
  useCrearAlimento,
} from '@/hooks/useAlimentos';
import type { AlimentoPropioPayload } from '@/services/alimentos';

/**
 * Base de alimentos del nutriólogo.
 *
 * Arriba, sus propios alimentos (los únicos que puede editar o retirar); abajo,
 * el catálogo completo en modo consulta.
 */
export default function AlimentosPage() {
  const [editando, setEditando] = useState<AlimentoFicha | null>(null);
  const [creando, setCreando] = useState(false);

  const crear = useCrearAlimento();
  const actualizar = useActualizarAlimento();
  const archivar = useArchivarAlimento();

  const guardar = (payload: AlimentoPropioPayload) => {
    if (editando) {
      actualizar.mutate(
        { id: editando.id, cambios: payload },
        { onSuccess: () => setEditando(null) },
      );
      return;
    }

    crear.mutate(payload, { onSuccess: () => setCreando(false) });
  };

  const enCurso = crear.isPending || actualizar.isPending;
  const errorGuardado = (editando ? actualizar.error : crear.error)?.message ?? null;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-emerald-950 font-medium">
            Base de alimentos
          </h1>
          <div className="text-stone-500 text-sm mt-1">
            Catálogo por grupos de equivalentes, más los alimentos que tú capturas
          </div>
        </div>
        <Btn onClick={() => setCreando(true)}>
          <Plus size={16} /> Nuevo alimento
        </Btn>
      </div>

      <div className="space-y-5">
        <SectionCard title="Mis alimentos">
          <BuscadorAlimentos
            soloPropios
            vacio="Todavía no capturas alimentos propios. Agrega los platillos y marcas que recetas seguido."
            accion={(alimento) => (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditando(alimento)}
                  className="text-stone-500 hover:bg-stone-100 rounded-lg p-1.5"
                  aria-label={`Editar ${alimento.nombre}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => archivar.mutate(alimento.id)}
                  disabled={archivar.isPending}
                  className="text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg p-1.5"
                  aria-label={`Retirar ${alimento.nombre}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          />
          {archivar.error && (
            <p className="text-xs text-orange-600 mt-2">{archivar.error.message}</p>
          )}
        </SectionCard>

        <SectionCard title="Catálogo completo">
          <BuscadorAlimentos accion={() => null} />
        </SectionCard>
      </div>

      {(creando || editando) && (
        <FormAlimento
          inicial={editando ?? undefined}
          guardando={enCurso}
          error={errorGuardado}
          onGuardar={guardar}
          onClose={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}
