'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

/**
 * Armazón del panel. En escritorio la navegación es una columna fija; abajo de
 * `md` se convierte en un cajón que se abre desde la barra superior, porque 224
 * px de menú permanente no caben en un teléfono.
 *
 * El estado vive aquí (cliente) y no en `layout.tsx`, que debe seguir siendo un
 * componente de servidor para revalidar la sesión antes de pintar el panel.
 */
export function PanelShell({ children }: { children: React.ReactNode }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const pathname = usePathname();

  // Navegar cierra el cajón: en móvil tapa el contenido que se acaba de pedir.
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuAbierto) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAbierto(false);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [menuAbierto]);

  return (
    <div className="flex h-dvh bg-stone-50">
      {menuAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-40 bg-emerald-950/40 lg:hidden"
        />
      )}

      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onAbrirMenu={() => setMenuAbierto(true)} />
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
