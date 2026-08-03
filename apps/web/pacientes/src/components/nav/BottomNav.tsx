'use client';

import { CalendarDays, Home, MessageCircle, Plus, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAbrirRegistro } from '@/features/hoy/registro/RegistroProvider';
import { useSinLeer } from '@/features/mensajes/useMensajes';

/**
 * Navegación inferior: Hoy · Plan · **+** · Progreso · Mensajes.
 *
 * El prototipo cambiaba de pestaña con `useState`; aquí cada destino es una
 * ruta real con `next/link`, así que el botón de atrás del teléfono funciona,
 * la pantalla se puede compartir por enlace y la app instalada abre donde el
 * paciente la dejó.
 */

export const DESTINOS = [
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
  const sinLeer = useSinLeer();
  const [hoy, plan, progreso, mensajes] = DESTINOS;

  return (
    <nav
      aria-label="Navegación principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-app items-center justify-around border-t border-stone-200 bg-white px-2 pt-2 lg:hidden"
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

      <Destino key={progreso.href} {...progreso} pathname={pathname} />
      <Destino key={mensajes.href} {...mensajes} pathname={pathname} sinLeer={sinLeer} />
    </nav>
  );
}

/** Tope del globo: "9+" en vez de un número que deforme la pestaña. */
const MAX_INDICADOR = 9;

export function textoDelIndicador(sinLeer: number): string {
  return sinLeer > MAX_INDICADOR ? `${MAX_INDICADOR}+` : String(sinLeer);
}

function Destino({
  href,
  etiqueta,
  icono: Icono,
  pathname,
  sinLeer = 0,
}: (typeof DESTINOS)[number] & { pathname: string; sinLeer?: number }) {
  const activo = esRutaActiva(pathname, href);

  return (
    <Link
      href={href}
      // `aria-current` es lo que le dice al lector de pantalla cuál es la
      // sección actual; el color solo lo comunica a quien lo ve.
      aria-current={activo ? 'page' : undefined}
      className="flex flex-1 flex-col items-center gap-0.5 pb-3"
    >
      <span className="relative">
        <Icono size={22} aria-hidden className={activo ? 'text-emerald-900' : 'text-stone-400'} />
        {sinLeer > 0 && (
          <span
            aria-hidden
            className="absolute -right-2 -top-1 min-w-4 rounded-full bg-emerald-700 px-1 text-center font-mono text-[9px] leading-4 text-white"
          >
            {textoDelIndicador(sinLeer)}
          </span>
        )}
      </span>
      <span className={`text-[10px] ${activo ? 'font-medium text-emerald-900' : 'text-stone-400'}`}>
        {etiqueta}
      </span>
      {/* El globo es `aria-hidden`: el conteo se anuncia aquí, con palabras,
          porque un "3" suelto junto a "Mensajes" no dice de qué son. */}
      {sinLeer > 0 && (
        <span className="sr-only">
          {sinLeer === 1 ? '1 mensaje sin leer' : `${sinLeer} mensajes sin leer`}
        </span>
      )}
    </Link>
  );
}
