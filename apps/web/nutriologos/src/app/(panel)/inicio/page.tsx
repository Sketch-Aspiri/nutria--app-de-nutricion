import { ArrowRight, Check, Circle, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { calcularOnboarding } from '@/server/onboarding';

export default async function InicioPage() {
  const sesion = await auth();
  if (!sesion?.user?.id) redirect('/login');

  const [perfil, pacientes, planes, citas] = await Promise.all([
    prisma.nutritionistProfile.findUnique({
      where: { userId: sesion.user.id },
      select: { cedulaProfesional: true, especialidad: true, telefono: true },
    }),
    prisma.patient.count({
      where: { nutritionistId: sesion.user.id, deletedAt: null },
    }),
    prisma.mealPlan.count({
      where: { patient: { nutritionistId: sesion.user.id, deletedAt: null } },
    }),
    prisma.appointment.count({ where: { nutritionistId: sesion.user.id } }),
  ]);

  const avance = calcularOnboarding({
    perfilProfesionalCompleto: Boolean(
      perfil?.cedulaProfesional && perfil.especialidad && perfil.telefono,
    ),
    pacientes,
    planes,
    citas,
  });
  const siguiente = avance.pasos.find((paso) => !paso.completado);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-3xl bg-emerald-950 text-stone-50">
        <div className="grid gap-8 p-5 sm:p-7 md:grid-cols-[1fr_15rem] md:p-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200">
              <Sparkles size={13} /> Programa piloto
            </div>
            <h1 className="max-w-xl font-display text-3xl font-medium leading-tight sm:text-4xl">
              Tu consulta, lista para una prueba segura.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-100">
              Completa este recorrido con datos ficticios primero. Cuando captures información
              clínica real, confirma el consentimiento del paciente y evita pegar datos sensibles
              en soporte o reportes de errores.
            </p>
            {siguiente ? (
              <Link
                href={siguiente.href}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-lime-200"
              >
                Continuar: {siguiente.titulo} <ArrowRight size={16} />
              </Link>
            ) : (
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-lime-200">
                <Check size={17} /> Recorrido piloto completado
              </div>
            )}
          </div>
          <div className="flex items-center justify-center">
            <div
              className="grid aspect-square w-44 place-items-center rounded-full"
              style={{
                background: `conic-gradient(#bef264 ${avance.porcentaje}%, #064e3b 0)`,
              }}
              aria-label={`${avance.porcentaje}% del onboarding completado`}
            >
              <div className="grid h-36 w-36 place-items-center rounded-full bg-emerald-950 text-center">
                <div>
                  <div className="font-display text-4xl text-lime-200">{avance.porcentaje}%</div>
                  <div className="mt-1 text-xs text-emerald-300">
                    {avance.completados} de {avance.pasos.length} pasos
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        {avance.pasos.map((paso, indice) => (
          <Link
            key={paso.id}
            href={paso.href}
            className="group flex gap-4 rounded-2xl border border-stone-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
          >
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                paso.completado
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-stone-100 text-stone-400'
              }`}
            >
              {paso.completado ? <Check size={18} /> : <Circle size={18} />}
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-400">
                Paso {indice + 1}
              </div>
              <h2 className="mt-1 font-medium text-emerald-950">{paso.titulo}</h2>
              <p className="mt-1 text-sm leading-5 text-stone-500">{paso.descripcion}</p>
            </div>
          </Link>
        ))}
      </section>

      <aside className="mt-6 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
        <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={20} />
        <div>
          <div className="font-medium">Canal piloto con privacidad desde el inicio</div>
          <p className="mt-1 leading-5 text-emerald-800">
            El aviso vigente está disponible en{' '}
            <Link className="underline underline-offset-2" href="/privacidad">
              Privacidad
            </Link>
            . Para soporte, comparte identificadores técnicos; nunca nombres, diagnósticos,
            medidas ni capturas de expedientes.
          </p>
        </div>
      </aside>
    </main>
  );
}
