import type { RegistroPeso } from '@nutria/shared';

type WeightChartProps = {
  data: RegistroPeso[];
};

/** Mini gráfica SVG del historial de peso; suficiente para el MVP sin librerías de charts. */
export function WeightChart({ data }: WeightChartProps) {
  if (data.length < 2) {
    return <div className="text-xs text-stone-400">Aún no hay historial suficiente.</div>;
  }
  const w = 220;
  const h = 70;
  const pad = 8;
  const pesos = data.map((d) => d.peso);
  const min = Math.min(...pesos) - 1;
  const max = Math.max(...pesos) + 1;
  const pts = data.map((d, i): [number, number] => [
    pad + (i / (data.length - 1)) * (w - pad * 2),
    h - pad - ((d.peso - min) / (max - min || 1)) * (h - pad * 2),
  ]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ');
  return (
    <svg width={w} height={h} role="img" aria-label="Evolución de peso">
      <path d={path} fill="none" stroke="#166534" strokeWidth="2" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#84cc16" />
      ))}
    </svg>
  );
}
