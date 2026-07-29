import { TrendingUp } from 'lucide-react';

import { EstadoVacio, Pantalla } from '@/components/ui/Pantalla';

export const metadata = { title: 'Tu progreso — nutria' };

/** Cascarón de Progreso. La fase 9 trae la gráfica de peso y los logros. */
export default function ProgresoPage() {
  return (
    <Pantalla titulo="Tu progreso" subtitulo="Peso, rachas y logros">
      <EstadoVacio
        icono={TrendingUp}
        titulo="Todavía no hay nada que graficar"
        descripcion="Registra tu peso al menos dos veces para ver tu tendencia y empezar a sumar logros."
      />
    </Pantalla>
  );
}
