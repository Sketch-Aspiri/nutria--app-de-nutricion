import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { auth } from '@/server/auth';
import { PRIVACY_NOTICE_VERSION } from '@/config/privacy';
import { CerrarSesion } from '@/components/auth/CerrarSesion';
import { AvatarPerfil } from '@/components/ui/Avatar';
import { Pantalla } from '@/components/ui/Pantalla';

export const metadata = { title: 'Tu perfil — nutria' };
export const dynamic = 'force-dynamic';

/**
 * Perfil — cascarón.
 *
 * Muestra lo que la sesión ya sabe (nombre y correo) y las dos acciones que el
 * cascarón necesita para ser probable de punta a punta: ver el aviso de
 * privacidad y cerrar sesión. Los datos clínicos, la nutrióloga asignada, los
 * recordatorios, el cambio de contraseña y los derechos ARCO son de la fase 11.
 */
export default async function PerfilPage() {
  const sesion = await auth();
  const nombre = sesion?.user?.name ?? '';
  const email = sesion?.user?.email ?? '';

  return (
    <Pantalla titulo="Tu perfil">
      <div className="mx-5 flex items-center gap-3 rounded-3xl border border-stone-200 bg-white p-5">
        <AvatarPerfil nombre={nombre} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-emerald-950">{nombre || 'Paciente'}</p>
          <p className="truncate text-xs text-stone-400">{email}</p>
        </div>
      </div>

      <div className="mx-5 mt-4 overflow-hidden rounded-3xl border border-stone-200 bg-white">
        <Link
          href="/privacidad"
          className="flex items-center justify-between px-5 py-4 text-sm text-stone-700 hover:bg-stone-50"
        >
          <span>
            Aviso de privacidad
            <span className="ml-2 font-mono text-[11px] text-stone-400">
              {PRIVACY_NOTICE_VERSION}
            </span>
          </span>
          <ChevronRight size={18} className="text-stone-300" aria-hidden />
        </Link>
      </div>

      <div className="mx-5 mt-6">
        <CerrarSesion />
      </div>

      <p className="mx-5 mt-4 text-center text-[11px] leading-relaxed text-stone-400">
        Tu expediente clínico lo resguarda tu nutrióloga. Cerrar sesión aquí no lo borra.
      </p>
    </Pantalla>
  );
}
