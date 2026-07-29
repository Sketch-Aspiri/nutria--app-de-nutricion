import { BottomNav } from '@/components/nav/BottomNav';

/**
 * Layout de las pantallas con sesión. La navegación inferior vive aquí y no en
 * el layout raíz porque `/entrar`, `/activar` y `/privacidad` no deben
 * mostrarla: ofrecer pestañas a quien no ha entrado solo produce redirecciones.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
