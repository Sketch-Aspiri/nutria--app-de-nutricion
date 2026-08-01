import { fechaCorta, formatearKg, geometriaDeGrafica, GRAFICA } from './calculos';
import type { RegistroPeso } from './types';

/**
 * Gráfica de peso.
 *
 * **Deuda declarada (§9, fase 9).** Es hermana de
 * `apps/web/nutriologos/src/components/ui/WeightChart.tsx`. Se copió en vez de
 * compartirse porque `packages/ui-tokens` hoy solo exporta tokens —colores,
 * tipografía, espaciado— y meterle el primer componente React obligaría a
 * darle build de JSX y dependencia de React para un solo consumidor. Cuando
 * exista un segundo componente compartido se crea `packages/ui` y las dos se
 * mudan ahí. Las diferencias no son cosméticas: esta escala al ancho del
 * teléfono con `viewBox` en vez de fijar 220×70 px, y anuncia la tendencia a
 * un lector de pantalla, que la del panel no hace.
 */
export function GraficaPeso({ pesos }: { pesos: RegistroPeso[] }) {
  const geometria = geometriaDeGrafica(pesos);

  if (!geometria) {
    return (
      <p className="py-6 text-center text-xs leading-relaxed text-stone-400">
        Registra tu peso al menos dos veces para ver tu tendencia.
      </p>
    );
  }

  const { puntos, linea, area, pesoMinimo, pesoMaximo } = geometria;
  const primero = puntos[0]!;
  const ultimo = puntos[puntos.length - 1]!;

  return (
    <figure className="mt-3">
      <svg
        viewBox={`0 0 ${GRAFICA.ancho} ${GRAFICA.alto}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Evolución de tu peso: de ${formatearKg(primero.peso)} kilos el ${fechaCorta(
          primero.fecha,
        )} a ${formatearKg(ultimo.peso)} kilos el ${fechaCorta(ultimo.fecha)}.`}
      >
        <defs>
          <linearGradient id="degradadoPeso" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#047857" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill="url(#degradadoPeso)" />
        <path
          d={linea}
          fill="none"
          stroke="#047857"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {puntos.map((punto) => (
          <circle
            key={punto.fecha}
            cx={punto.x}
            cy={punto.y}
            r="3"
            fill="#ffffff"
            stroke="#047857"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      <figcaption className="mt-2 flex items-center justify-between text-[10px] text-stone-400">
        <span>{fechaCorta(primero.fecha)}</span>
        <span className="font-mono">
          {formatearKg(pesoMinimo)} – {formatearKg(pesoMaximo)} kg
        </span>
        <span>{fechaCorta(ultimo.fecha)}</span>
      </figcaption>
    </figure>
  );
}
