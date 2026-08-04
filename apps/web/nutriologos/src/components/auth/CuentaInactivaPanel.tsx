'use client';

import { ArrowRight, Clock3, Leaf, LogOut, Mail } from 'lucide-react';
import { signOut } from 'next-auth/react';

export function CuentaInactivaPanel({ contacto }: { contacto: string }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-emerald-950 px-4 py-10 text-white">
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full border-[42px] border-lime-300/10" />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-emerald-800/25 blur-3xl" />

      <section className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/25">
        <div className="bg-[#f4f1e7] px-6 py-8 text-stone-800 sm:px-10 sm:py-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-2xl text-emerald-950">
              <Leaf size={22} /> nutria
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Acceso pausado
            </span>
          </div>

          <div className="mt-10 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-950 text-lime-300">
            <Clock3 size={27} />
          </div>
          <h1 className="mt-5 font-display text-3xl font-medium leading-tight text-emerald-950 sm:text-4xl">
            Tu mes de acceso terminó
          </h1>
          <p className="mt-4 text-sm leading-7 text-stone-600">
            Tus pacientes y expedientes siguen guardados de forma segura. Para reactivar todas las
            funciones de Pro por un mes más, confirma tu renovación con el equipo de nutria.
          </p>

          <a
            href={`mailto:${contacto}?subject=${encodeURIComponent('Renovación de acceso Pro en nutria')}`}
            className="mt-7 flex items-center justify-between rounded-2xl bg-emerald-950 px-5 py-4 text-sm font-medium text-white transition hover:bg-emerald-900"
          >
            <span className="flex items-center gap-3">
              <Mail size={18} className="text-lime-300" /> Contactar para renovar
            </span>
            <ArrowRight size={18} />
          </a>
          <p className="mt-3 text-center text-xs text-stone-400">{contacto}</p>

          <div className="mt-8 border-t border-stone-200 pt-5">
            <button
              type="button"
              onClick={() => void signOut({ redirectTo: '/login' })}
              className="mx-auto flex items-center gap-2 text-sm text-stone-500 hover:text-emerald-900"
            >
              <LogOut size={16} /> Volver a iniciar sesión después de la activación
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
