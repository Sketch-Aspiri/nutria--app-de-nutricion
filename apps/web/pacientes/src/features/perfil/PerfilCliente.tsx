'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Bell, ChevronRight, Stethoscope, Target } from 'lucide-react';

import { Cargando, ErrorDeCarga } from '@/components/ui/Estados';
import { Pantalla } from '@/components/ui/Pantalla';
import { PRIVACY_NOTICE_VERSION } from '@/config/privacy';

import { CambiarPassword } from './CambiarPassword';
import { descripcionDeObjetivo, inicialesDe } from './calculos';
import { MisDatos } from './MisDatos';
import { usePerfil } from './usePerfil';
import { CerrarSesion } from '@/components/auth/CerrarSesion';

/**
 * Perfil, privacidad y cuenta.
 *
 * Todo lo que muestra es de **lectura**: el nombre, el objetivo y la nutrióloga
 * asignada los define la profesional en consulta, no el paciente desde el
 * teléfono. Un campo editable aquí crearía dos fuentes de verdad para el mismo
 * dato clínico.
 */
export function PerfilCliente() {
  const perfil = usePerfil();

  if (perfil.isPending) {
    return (
      <Pantalla titulo="Tu perfil">
        <Cargando etiqueta="Cargando tu perfil" />
      </Pantalla>
    );
  }

  if (perfil.isError) {
    return (
      <Pantalla titulo="Tu perfil">
        <ErrorDeCarga titulo="No pudimos cargar tu perfil" onReintentar={() => perfil.refetch()} />
      </Pantalla>
    );
  }

  const datos = perfil.data;
  const objetivo = descripcionDeObjetivo(datos);

  return (
    <Pantalla titulo="Tu perfil">
      <div className="mx-5 flex items-center gap-3 rounded-3xl border border-stone-200 bg-white p-5">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-base font-medium text-white"
        >
          {inicialesDe(datos.nombre) || '·'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-emerald-950">
            {datos.nombre || 'Paciente'}
          </p>
          <p className="truncate text-xs text-stone-400">{datos.email ?? 'Sin correo'}</p>
        </div>
      </div>

      <div className="mx-5 mt-3 space-y-3">
        <Dato
          icono={<Stethoscope size={16} className="text-emerald-800" aria-hidden />}
          etiqueta="Tu nutrióloga"
          valor={datos.nutriologo.nombre}
          detalle={datos.nutriologo.consultorio}
        />
        <Dato
          icono={<Target size={16} className="text-emerald-800" aria-hidden />}
          etiqueta="Tu objetivo"
          valor={objetivo}
          // Sin objetivo no se inventa uno: lo define ella en consulta.
          vacio="Tu nutrióloga aún no registra un objetivo."
        />
      </div>

      <Recordatorios />

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

      <CambiarPassword />

      <MisDatos onBaja={() => void signOut({ redirectTo: '/entrar?baja=1' })} />

      <div className="mx-5 mt-6">
        <CerrarSesion />
      </div>

      <p className="mx-5 mt-4 text-center text-[11px] leading-relaxed text-stone-400">
        Tu expediente clínico lo resguarda tu nutrióloga. Cerrar sesión aquí no lo borra.
      </p>
    </Pantalla>
  );
}

function Dato({
  icono,
  etiqueta,
  valor,
  detalle,
  vacio,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string | null;
  detalle?: string | null;
  vacio?: string;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2">
        {icono}
        <h2 className="text-xs text-stone-500">{etiqueta}</h2>
      </div>
      {valor ? (
        <>
          <p className="mt-1.5 text-sm text-emerald-950">{valor}</p>
          {detalle && <p className="mt-0.5 text-[11px] text-stone-400">{detalle}</p>}
        </>
      ) : (
        <p className="mt-1.5 text-xs text-stone-400">{vacio}</p>
      )}
    </section>
  );
}

/**
 * Recordatorios.
 *
 * Es información, no un interruptor. El modelo no guarda una preferencia de
 * recordatorios por paciente —§12 deja las notificaciones push fuera de la V1 y
 * los avisos siguen por correo, con el cron que ya existe del lado del panel—,
 * así que un switch aquí no escribiría en ningún lado. Un control que finge
 * guardar una preferencia es peor que no tenerlo: el paciente lo apaga, cree
 * que dejó de recibir correos, y los sigue recibiendo.
 */
function Recordatorios() {
  return (
    <section className="mx-5 mt-3 rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Bell size={16} className="text-emerald-800" aria-hidden />
        <h2 className="text-xs text-stone-500">Recordatorios</h2>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
        Te avisamos por correo antes de cada cita. La app no envía notificaciones al teléfono.
      </p>
    </section>
  );
}
