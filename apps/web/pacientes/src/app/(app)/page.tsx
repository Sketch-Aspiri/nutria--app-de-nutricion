import { UtensilsCrossed } from 'lucide-react';

import { auth } from '@/server/auth';
import { EstadoVacio, Pantalla } from '@/components/ui/Pantalla';
import { AvatarPerfil } from '@/components/ui/Avatar';

export const metadata = { title: 'Hoy — nutria' };
export const dynamic = 'force-dynamic';

/**
 * Pantalla Hoy — cascarón.
 *
 * El anillo de calorías, el agua, la adherencia y el plan del día los arma la
 * fase 7 sobre `GET /api/v1/me/today`, que ya existe. Aquí solo se establece la
 * estructura y el estado vacío, sin datos de ejemplo: una cifra inventada en
 * una app de salud se lee como información sobre uno mismo.
 */
export default async function HoyPage() {
  const sesion = await auth();
  const nombre = sesion?.user?.name ?? '';

  return (
    <Pantalla
      titulo={nombre.split(' ')[0] || 'Hola'}
      subtitulo="Buen día"
      accion={<AvatarPerfil nombre={nombre} />}
    >
      <EstadoVacio
        icono={UtensilsCrossed}
        titulo="Tu día todavía no tiene nada registrado"
        descripcion="Cuando tu nutrióloga comparta tu plan, aquí verás tus comidas, tu agua y tu avance del día."
      />
    </Pantalla>
  );
}
