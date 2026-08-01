'use client';

import { LineChart } from 'lucide-react';

import { Cargando, ErrorDeCarga } from '@/components/ui/Estados';
import { Pantalla } from '@/components/ui/Pantalla';

import { serieDePesos } from './calculos';
import { GraficaPeso } from './GraficaPeso';
import { ListaLogros } from './ListaLogros';
import { TarjetasPeso } from './TarjetasPeso';
import { useProgreso } from './useProgreso';

/**
 * Pantalla Progreso: peso y logros.
 *
 * Una sola lectura (`/api/v1/me/progress`) alimenta las tres secciones, así que
 * la gráfica y los logros nunca describen momentos distintos del mismo
 * paciente. Sin pesajes la pantalla no se queda en blanco: los logros que ya
 * dependen de comidas, agua o ejercicio se muestran igual, porque avanzan
 * aunque el paciente todavía no se haya pesado.
 */
export function ProgresoCliente() {
  const progreso = useProgreso();

  if (progreso.isPending) {
    return (
      <Pantalla titulo="Tu progreso" subtitulo="Peso, rachas y logros">
        <Cargando etiqueta="Cargando tu progreso" />
      </Pantalla>
    );
  }

  if (progreso.isError) {
    return (
      <Pantalla titulo="Tu progreso" subtitulo="Peso, rachas y logros">
        <ErrorDeCarga
          titulo="No pudimos cargar tu progreso"
          onReintentar={() => progreso.refetch()}
        />
      </Pantalla>
    );
  }

  const datos = progreso.data;
  const pesajes = serieDePesos(datos.pesos);

  return (
    <Pantalla titulo="Tu progreso" subtitulo="Peso, rachas y logros">
      <TarjetasPeso progreso={datos} />

      <section className="mx-5 mt-3 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-emerald-950">
          <LineChart size={16} className="text-emerald-800" aria-hidden />
          Tu peso
        </h2>
        <GraficaPeso pesos={datos.pesos} />
        {pesajes.length === 1 && (
          <p className="mt-1 text-center text-[10px] text-stone-400">
            Llevas 1 pesaje registrado.
          </p>
        )}
      </section>

      <ListaLogros logros={datos.logros} />

      <p className="mx-5 mt-4 text-center text-[10px] leading-relaxed text-stone-400">
        Tus logros se calculan con lo que registras. Si corriges un dato, se recalculan solos.
      </p>
    </Pantalla>
  );
}
