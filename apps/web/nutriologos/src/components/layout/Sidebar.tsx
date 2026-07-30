'use client';

import {
  Calendar,
  Compass,
  CreditCard,
  LayoutTemplate,
  LogOut,
  MessageCircle,
  Palette,
  Receipt,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { usePerfil } from '@/hooks/usePerfil';

const NAV_ITEMS = [
  { href: '/inicio', label: 'Inicio', icon: Compass },
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/mensajes', label: 'Mensajes', icon: MessageCircle },
  { href: '/facturacion', label: 'Facturación', icon: Receipt },
  { href: '/alimentos', label: 'Alimentos', icon: Utensils },
  { href: '/plantillas', label: 'Plantillas', icon: LayoutTemplate },
  { href: '/marca', label: 'Marca y datos', icon: Palette },
  { href: '/suscripcion', label: 'Suscripción', icon: CreditCard },
];

type SidebarProps = {
  /** Solo aplica abajo de `md`, donde la navegación es un cajón superpuesto. */
  abierto?: boolean;
  onCerrar?: () => void;
};

export function Sidebar({ abierto = false, onCerrar }: SidebarProps) {
  const pathname = usePathname();
  const perfil = usePerfil();
  const nombreMarca = perfil.data?.perfil?.marca_nombre || 'nutria';

  const cerrarSesion = () => {
    void signOut({ redirectTo: '/login' });
  };

  // Cerrado en móvil se oculta con `invisible`, no solo desplazado: así sale
  // también del orden de tabulación en vez de quedar enfocable fuera de pantalla.
  const visibilidad = abierto ? 'translate-x-0' : '-translate-x-full invisible';

  return (
    <nav
      aria-label="Navegación principal"
      className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-emerald-950 text-stone-100 transition-transform duration-200 lg:static lg:w-56 lg:translate-x-0 lg:visible ${visibilidad}`}
    >
      <div className="flex items-start justify-between px-6 py-7">
        <div>
          <div className="font-display text-2xl font-medium tracking-tight">{nombreMarca}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-emerald-400">
            Panel de nutriólogo
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar menú"
          className="-mr-2 rounded-lg p-2 text-emerald-300 hover:bg-emerald-900/60 lg:hidden"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((it) => {
          const activo = pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={onCerrar}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                activo ? 'bg-emerald-900 text-lime-300' : 'text-emerald-200 hover:bg-emerald-900/60'
              }`}
            >
              <it.icon size={17} /> {it.label}
            </Link>
          );
        })}
      </div>
      <div className="border-t border-emerald-900 px-3 pb-5 pt-4">
        <button
          type="button"
          onClick={cerrarSesion}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-emerald-300 hover:bg-emerald-900/60"
        >
          <LogOut size={17} /> Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
