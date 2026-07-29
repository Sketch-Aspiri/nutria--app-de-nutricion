'use client';

import { CalendarDays, Home, MessageCircle, Plus, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAbrirRegistro } from '@/features/hoy/registro/RegistroProvider';

/**
 * Navegación inferior: Hoy · Plan · **+** · Progreso · Mensajes.
 *
 * El prototipo cambiaba de pestaña con `useState`; aquí cada destino es una
 * ruta real con `next/link`, así que el botón de atrás del teléfono funciona,
 * la pantalla se puede compartir por enlace y la app instalada abre donde el
 * paciente la dejó.
 */

const DESTINOS = [
  { href: '/', etiqueta: 'Hoy', icono: Home },
  { href: '/plan', etiqueta: 'Plan', icono: CalendarDays },
  { href: '/progreso', etiqueta: 'Progreso', icono: TrendingUp },
  { href: '/mensajes', etiqueta: 'Mensajes', icono: MessageCircle },
] as const;

/** `/` solo está activo en la raíz; el resto también en sus subrutas. */
export function esRutaActiva(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const abrirRegistro = useAbrirRegistro();
  const [hoy, plan, progreso, mensajes] = DESTINOS;

  return (
    <nav
      aria-label="Navegación principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-app items-center justify-around border-t border-stone-200 bg-white px-2 pt-2"
    >
      {[hoy, plan].map((destino) => (
        <Destino key={destino.href} {...destino} pathname={pathname} />
      ))}

      <button
        type="button"
        aria-label="Registrar"
        onClick={abrirRegistro}
        className="-mt-6 rounded-full bg-emerald-900 p-3.5 text-white shadow-lg shadow-emerald-900/30 transition-colors hover:bg-emerald-800"
      >
        <Plus size={24} aria-hidden />
      </button>

      {[progreso, mensajes].map((destino) => (
        <Destino key={destino.href} {...destino} pathname={pathname} />
      ))}
    </nav>
  );
}

function Destino({
  href,
  etiqueta,
  icono: Icono,
  pathname,
}: (typeof DESTINOS)[number] & { pathname: string }) {
  const activo = esRutaActiva(pathname, href);

  return (
    <Link
      href={href}
      // `aria-current` es lo que le dice al lector de pantalla cuál es la
      // sección actual; el color solo lo comunica a quien lo ve.
      aria-current={activo ? 'page' : undefined}
      className="flex flex-1 flex-col items-center gap-0.5 pb-3"
    >
      <Icono size={22} aria-hidden className={activo ? 'text-emerald-900' : 'text-stone-400'} />
      <span className={`text-[10px] ${activo ? 'font-medium text-emerald-900' : 'text-stone-400'}`}>
        {etiqueta}
      </span>
    </Link>
  );
}
