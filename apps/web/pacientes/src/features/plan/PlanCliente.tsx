'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Pantalla } from '@/components/ui/Pantalla';

import { ActividadCompartida } from './ActividadCompartida';
import { ComidasDelPlan } from './ComidasDelPlan';
import { ListaRecetas } from './ListaRecetas';

/**
 * Pantalla Plan: comidas, recetas y actividad.
 *
 * La pestaña activa viaja en la URL (`/plan?vista=recetas`) y cada una es un
 * enlace, no un `useState` como en el prototipo. Así el botón de atrás del
 * teléfono funciona y —lo que de verdad se nota— al volver del detalle de una
 * receta el paciente regresa a la lista de recetas, no a las comidas.
 */

const VISTAS = [
  { clave: 'comidas', etiqueta: 'Comidas' },
  { clave: 'recetas', etiqueta: 'Recetas' },
  { clave: 'actividad', etiqueta: 'Actividad' },
] as const;

type Vista = (typeof VISTAS)[number]['clave'];

/** Una `?vista=` inventada cae en Comidas en vez de dejar la pantalla en blanco. */
export function vistaValida(valor: string | null | undefined): Vista {
  const encontrada = VISTAS.find((vista) => vista.clave === valor);
  return encontrada ? encontrada.clave : 'comidas';
}

export function PlanCliente() {
  const parametros = useSearchParams();
  const vista = vistaValida(parametros.get('vista'));

  return (
    <Pantalla titulo="Tu plan" subtitulo="Diseñado por tu nutrióloga">
      <nav
        aria-label="Secciones de tu plan"
        className="mx-5 mb-4 flex gap-1 rounded-xl bg-stone-100 p-1"
      >
        {VISTAS.map(({ clave, etiqueta }) => {
          const activa = clave === vista;
          return (
            <Link
              key={clave}
              href={clave === 'comidas' ? '/plan' : `/plan?vista=${clave}`}
              replace
              scroll={false}
              aria-current={activa ? 'page' : undefined}
              className={`flex-1 rounded-lg py-2 text-center text-sm transition-colors ${
                activa ? 'bg-white text-emerald-950 shadow-sm' : 'text-stone-500'
              }`}
            >
              {etiqueta}
            </Link>
          );
        })}
      </nav>

      {vista === 'comidas' && <ComidasDelPlan />}
      {vista === 'recetas' && <ListaRecetas />}
      {vista === 'actividad' && <ActividadCompartida />}
    </Pantalla>
  );
}
