import { BottomNav } from '@/components/nav/BottomNav';
import { Sidebar } from '@/components/nav/Sidebar';
import { RegistroProvider } from '@/features/hoy/registro/RegistroProvider';

/**
 * Layout de las pantallas con sesión. La navegación vive aquí y no en el
 * layout raíz porque `/entrar`, `/activar` y `/privacidad` no deben
 * mostrarla: ofrecer pestañas a quien no ha entrado solo produce redirecciones.
 *
 * En escritorio `Sidebar` reemplaza a `BottomNav` (cada una se oculta con
 * `lg:hidden` / muestra con `lg:flex` en su propio archivo); `lg:pl-56` le
 * deja el hueco a la barra lateral fija sin afectar el celular, donde no
 * ocupa espacio.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RegistroProvider>
      <Sidebar />
      <div className="lg:pl-56">{children}</div>
      <BottomNav />
    </RegistroProvider>
  );
}
