import { Flag, Scale, TrendingDown, TrendingUp } from 'lucide-react';

import { cambioDePeso, formatearKg } from './calculos';
import type { Progreso } from './types';

/**
 * Las tres tarjetas del encabezado: cambio, peso actual y lo que falta.
 *
 * Ninguna muestra un cero de relleno. Sin pesajes no hay "0 kg perdidos" —hay
 * un guion y una frase que explica qué falta para poder calcularlo—, porque en
 * una app de salud un cero se lee como información sobre el propio cuerpo.
 */
export function TarjetasPeso({ progreso }: { progreso: Progreso }) {
  const cambio = cambioDePeso(progreso.peso);
  const IconoCambio = cambio?.direccion === 'sube' ? TrendingUp : TrendingDown;

  return (
    <div className="mx-5 grid grid-cols-3 gap-3 lg:mx-0">
      {/*
        Con dos pesajes iguales el `0` sí es un dato —el paciente se pesó y no
        se movió—, no un relleno: se muestra. Lo que no se muestra es un cero
        cuando todavía no hay ningún pesaje.
      */}
      <Tarjeta
        icono={<IconoCambio size={15} className="text-emerald-700" aria-hidden />}
        etiqueta={cambio ? cambio.etiqueta : 'Cambio'}
        valor={cambio ? formatearKg(cambio.kg) : null}
        unidad="kg"
        nota={cambio?.direccion === 'igual' ? 'Igual que al inicio' : 'Desde tu primer pesaje'}
        vacio="Aún no registras tu peso"
      />

      <Tarjeta
        icono={<Scale size={15} className="text-emerald-700" aria-hidden />}
        etiqueta="Actual"
        valor={progreso.peso ? formatearKg(progreso.peso.actual) : null}
        unidad="kg"
        nota={progreso.peso ? `Inicio: ${formatearKg(progreso.peso.inicial)} kg` : undefined}
        vacio="Regístralo desde el botón +"
      />

      {/*
        `falta_kg` viaja siempre en `null`: el modelo no guarda un peso objetivo
        (§9). La tarjeta lo dice en vez de estimar una meta clínica que nadie
        acordó — el `null` del contrato es la respuesta honesta, no un hueco que
        haya que rellenar. El día que el esquema guarde la meta, esta tarjeta ya
        sabe pintarla.
      */}
      <Tarjeta
        icono={<Flag size={15} className="text-stone-400" aria-hidden />}
        etiqueta="Falta"
        valor={progreso.falta_kg !== null ? formatearKg(progreso.falta_kg) : null}
        unidad="kg"
        vacio="Tu nutrióloga aún no fija una meta de peso"
      />
    </div>
  );
}

function Tarjeta({
  icono,
  etiqueta,
  valor,
  unidad,
  nota,
  vacio,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string | null;
  unidad: string;
  nota?: string;
  vacio: string;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-3">
      <div className="flex items-center gap-1.5">
        {icono}
        <h2 className="text-[11px] text-stone-500">{etiqueta}</h2>
      </div>
      {valor === null ? (
        <p className="mt-2 text-[10px] leading-snug text-stone-400">{vacio}</p>
      ) : (
        <>
          <p className="mt-1.5 font-mono text-lg leading-tight text-emerald-950">
            {valor}
            <span className="ml-0.5 font-sans text-[10px] text-stone-400">{unidad}</span>
          </p>
          {nota && <p className="mt-1 text-[10px] leading-snug text-stone-400">{nota}</p>}
        </>
      )}
    </section>
  );
}
