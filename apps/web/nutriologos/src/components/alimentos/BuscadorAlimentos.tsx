'use client';

import { Loader2, Search } from 'lucide-react';
import { useState } from 'react';

import { type AlimentoFicha, type GrupoAlimento } from '@nutria/shared';

import {
  EtiquetaPropio,
  ImagenAlimento,
  ResumenMacros,
  textoEquivalentes,
} from '@/components/alimentos/FichaAlimento';
import { Chip } from '@/components/ui/Chip';
import { useAlimentos, useDebounce, useGruposAlimento } from '@/hooks/useAlimentos';

/**
 * Buscador de la base de alimentos contra `/api/v1/foods`.
 *
 * La búsqueda ocurre en Postgres (índice de trigramas), no en el cliente: el
 * catálogo tiene cientos de alimentos y va a crecer a miles, así que traerlo
 * entero para filtrarlo en memoria dejaría de funcionar muy pronto.
 */

const POR_PAGINA = 30;

type BuscadorProps = {
  /** Acción de la derecha de cada renglón (agregar al plan, editar, etc.). */
  accion: (alimento: AlimentoFicha) => React.ReactNode;
  soloPropios?: boolean;
  /** Mensaje cuando la búsqueda no arroja nada; depende del contexto. */
  vacio?: string;
};

export function BuscadorAlimentos({ accion, soloPropios = false, vacio }: BuscadorProps) {
  const [texto, setTexto] = useState('');
  const [grupo, setGrupo] = useState<GrupoAlimento | undefined>(undefined);
  const consulta = useDebounce(texto);

  const { grupos } = useGruposAlimento();
  const { alimentos, total, cargando, error } = useAlimentos({
    query: consulta || undefined,
    grupo,
    soloPropios,
    perPage: POR_PAGINA,
  });

  return (
    <div>
      <div className="flex items-center gap-2 border border-stone-200 rounded-lg px-3 py-2 mb-3 bg-white">
        <Search size={15} className="text-stone-400" />
        <input
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Buscar alimento..."
          aria-label="Buscar alimento"
          className="text-sm flex-1 focus:outline-none bg-transparent"
        />
        {cargando && <Loader2 size={14} className="animate-spin text-stone-300" />}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Chip label="Todos" active={grupo === undefined} onClick={() => setGrupo(undefined)} />
        {grupos
          .filter((opcion) => opcion.total > 0)
          .map((opcion) => (
            <Chip
              key={opcion.grupo}
              label={`${opcion.nombre} (${opcion.total})`}
              active={grupo === opcion.grupo}
              onClick={() => setGrupo(grupo === opcion.grupo ? undefined : opcion.grupo)}
            />
          ))}
      </div>

      {error && (
        <div className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          No pudimos cargar la base de alimentos. {error.message}
        </div>
      )}

      <ul className="max-h-72 overflow-auto divide-y divide-stone-100">
        {alimentos.map((alimento) => (
          <li key={alimento.id} className="flex items-center gap-3 py-2.5">
            <ImagenAlimento alimento={alimento} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-emerald-950 flex items-center gap-2">
                <span className="truncate">{alimento.nombre}</span>
                {alimento.es_propio && <EtiquetaPropio />}
              </div>
              <div className="text-xs text-stone-400 truncate">
                {alimento.porcion_descripcion} ({alimento.porcion_gramos} g) ·{' '}
                {textoEquivalentes(alimento.equivalentes)}
              </div>
            </div>
            <ResumenMacros alimento={alimento} />
            {accion(alimento)}
          </li>
        ))}
      </ul>

      {!cargando && alimentos.length === 0 && !error && (
        <p className="text-sm text-stone-400 py-6 text-center">
          {vacio ?? 'Ningún alimento coincide con la búsqueda.'}
        </p>
      )}

      {total > alimentos.length && (
        <p className="text-xs text-stone-400 pt-3 text-center">
          Se muestran {alimentos.length} de {total}. Afina la búsqueda para ver el resto.
        </p>
      )}
    </div>
  );
}
