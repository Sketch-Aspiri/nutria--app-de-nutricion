'use client';

import { Utensils } from 'lucide-react';

import {
  type AlimentoFicha,
  type Equivalentes,
  NOMBRE_GRUPO_ALIMENTO,
} from '@nutria/shared';

/**
 * Piezas de presentación de un alimento, compartidas por el buscador de la
 * pestaña de plan y por la pantalla de alimentos propios.
 */

type ImagenProps = {
  alimento: Pick<AlimentoFicha, 'imagen_url' | 'nombre'>;
  tamano?: number;
};

/**
 * Imagen del alimento con respaldo.
 *
 * Buena parte del catálogo todavía no tiene foto (se suben por lotes a Blob),
 * así que el hueco tiene que verse deliberado y no como un error de carga.
 */
export function ImagenAlimento({ alimento, tamano = 40 }: ImagenProps) {
  if (!alimento.imagen_url) {
    return (
      <div
        className="shrink-0 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center"
        style={{ width: tamano, height: tamano }}
        aria-hidden="true"
      >
        <Utensils size={Math.round(tamano * 0.45)} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={alimento.imagen_url}
      alt=""
      width={tamano}
      height={tamano}
      loading="lazy"
      className="shrink-0 rounded-lg object-cover bg-stone-100"
      style={{ width: tamano, height: tamano }}
    />
  );
}

/** "1 eq. cereales · 0.5 eq. aceites" — como lo lee un nutriólogo. */
export function textoEquivalentes(equivalentes: Equivalentes): string {
  const renglones = Object.entries(equivalentes)
    .filter(([, cantidad]) => Boolean(cantidad))
    .map(
      ([grupo, cantidad]) =>
        `${cantidad} eq. ${NOMBRE_GRUPO_ALIMENTO[grupo as keyof typeof NOMBRE_GRUPO_ALIMENTO].toLowerCase()}`,
    );

  return renglones.length > 0 ? renglones.join(' · ') : 'Sin equivalentes';
}

/** Energía y macros de la porción, en la notación abreviada de consulta. */
export function ResumenMacros({ alimento }: { alimento: AlimentoFicha }) {
  return (
    <span className="font-mono text-xs text-stone-400 whitespace-nowrap">
      {Math.round(alimento.energia_kcal)} kcal · P{redondear(alimento.proteina_g)} C
      {redondear(alimento.carbohidratos_g)} G{redondear(alimento.lipidos_g)}
    </span>
  );
}

function redondear(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/** Distingue el alimento capturado por el nutriólogo del catálogo común. */
export function EtiquetaPropio() {
  return (
    <span className="text-[10px] uppercase tracking-wide bg-lime-100 text-emerald-900 rounded px-1.5 py-0.5">
      Propio
    </span>
  );
}
