'use client';

import {
  Calendar,
  LayoutTemplate,
  LogOut,
  MessageCircle,
  Palette,
  Receipt,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useAppState } from '@/store/app-state';

const NAV_ITEMS = [
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/mensajes', label: 'Mensajes', icon: MessageCircle },
  { href: '/facturacion', label: 'Facturación', icon: Receipt },
  { href: '/plantillas', label: 'Plantillas', icon: LayoutTemplate },
  { href: '/marca', label: 'Marca y datos', icon: Palette },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { marca, logout } = useAppState();

  const cerrarSesion = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="w-56 bg-emerald-950 text-stone-100 flex flex-col shrink-0">
      <div className="px-6 py-7">
        <div className="font-display text-2xl font-medium tracking-tight">
          {marca.nombre || 'nutria'}
        </div>
        <div className="text-emerald-400 text-xs mt-1 tracking-wide uppercase">
          Panel de nutriólogo
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((it) => {
          const activo = pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activo ? 'bg-emerald-900 text-lime-300' : 'text-emerald-200 hover:bg-emerald-900/60'
              }`}
            >
              <it.icon size={17} /> {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-5 border-t border-emerald-900 pt-4">
        <button
          type="button"
          onClick={cerrarSesion}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-emerald-300 hover:bg-emerald-900/60"
        >
          <LogOut size={17} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
