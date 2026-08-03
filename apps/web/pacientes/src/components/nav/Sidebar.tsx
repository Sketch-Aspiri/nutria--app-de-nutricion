'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAbrirRegistro } from '@/features/hoy/registro/RegistroProvider';
import { useSinLeer } from '@/features/mensajes/useMensajes';

import { DESTINOS, esRutaActiva, textoDelIndicador } from './BottomNav';

/**
 * Navegación de escritorio: misma barra inferior, otra forma.
 *
 * En pantallas grandes ya no hace falta economizar el toque del pulgar, así
 * que las cuatro rutas y el registro ganan una etiqueta permanente en vez de
 * competir por espacio en una fila. `BottomNav` se oculta con `lg:hidden` y
 * esta barra usa `hidden lg:flex`: nunca coexisten.
 */
export function Sidebar() {
  const pathname = usePathname();
  const abrirRegistro = useAbrirRegistro();
  const sinLeer = useSinLeer();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-stone-200 bg-white px-4 py-6 lg:flex"
    >
      <Link href="/" className="px-2 font-display text-xl font-medium text-emerald-950">
        nutria
      </Link>

      <button
        type="button"
        onClick={abrirRegistro}
        className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
      >
        <Plus size={17} aria-hidden />
        Registrar
      </button>

      <ul className="mt-6 space-y-1">
        {DESTINOS.map(({ href, etiqueta, icono: Icono }) => {
          const activo = esRutaActiva(pathname, href);
          const sinLeerDestino = href === '/mensajes' ? sinLeer : 0;

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activo ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  activo
                    ? 'bg-emerald-50 font-medium text-emerald-900'
                    : 'text-stone-500 hover:bg-stone-50'
                }`}
              >
                <Icono size={18} aria-hidden />
                {etiqueta}
                {sinLeerDestino > 0 && (
                  <span
                    aria-hidden
                    className="ml-auto min-w-4 rounded-full bg-emerald-700 px-1 text-center font-mono text-[10px] leading-4 text-white"
                  >
                    {textoDelIndicador(sinLeerDestino)}
                  </span>
                )}
                {sinLeerDestino > 0 && (
                  <span className="sr-only">
                    {sinLeerDestino === 1
                      ? '1 mensaje sin leer'
                      : `${sinLeerDestino} mensajes sin leer`}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
