'use client';

import { Leaf, LogOut, ShieldCheck, Users } from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f3f1e9] text-stone-800">
      <header className="border-b border-emerald-950/10 bg-emerald-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/superadmin/nutriologas" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-lime-300 text-emerald-950">
              <Leaf size={20} />
            </span>
            <span>
              <span className="block font-display text-xl leading-none">nutria</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                Operación interna
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-700 bg-emerald-900 px-3 py-1.5 text-xs text-emerald-100 sm:flex">
              <ShieldCheck size={14} className="text-lime-300" /> Superadmin
            </span>
            <button
              type="button"
              onClick={() => void signOut({ redirectTo: '/login' })}
              className="rounded-full p-2.5 text-emerald-200 transition-colors hover:bg-emerald-900 hover:text-white"
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-6 rounded-2xl border border-emerald-950/10 bg-white/70 p-2 shadow-sm backdrop-blur">
            <Link
              href="/superadmin/nutriologas"
              className="flex items-center gap-3 rounded-xl bg-emerald-950 px-3 py-3 text-sm text-white"
            >
              <Users size={17} className="text-lime-300" /> Nutriólogas
            </Link>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
