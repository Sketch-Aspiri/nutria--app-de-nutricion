import { CalendarDays } from 'lucide-react';

import { EstadoVacio, Pantalla } from '@/components/ui/Pantalla';

export const metadata = { title: 'Tu plan — nutria' };

/** Cascarón de Plan y recetas. La fase 8 lo llena desde `/me/meal_plan`. */
export default function PlanPage() {
  return (
    <Pantalla titulo="Tu plan" subtitulo="Diseñado por tu nutrióloga">
      <EstadoVacio
        icono={CalendarDays}
        titulo="Tu nutrióloga aún no comparte tu plan"
        descripcion="En cuanto lo apruebe y te lo envíe, aparecerá aquí con tus comidas, porciones y recetas."
      />
    </Pantalla>
  );
}
