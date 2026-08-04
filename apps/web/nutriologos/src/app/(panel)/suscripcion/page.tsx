'use client';

import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { BarraDeUso } from '@/components/suscripcion/BarraDeUso';
import { ETIQUETA_ESTADO, ETIQUETA_PLAN, fechaLarga } from '@/components/suscripcion/formato';
import { TarjetaPlan } from '@/components/suscripcion/TarjetaPlan';
import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAbrirPortal, useIniciarCheckout, useSuscripcion } from '@/hooks/useSuscripcion';

export default function SuscripcionPage() {
  return (
    <Suspense fallback={<Cargando />}>
      <ContenidoSuscripcion />
    </Suspense>
  );
}

function Cargando() {
  return (
    <div className="flex items-center gap-2 p-4 text-sm text-stone-400 sm:p-6 lg:p-8">
      <Loader2 size={16} className="animate-spin" /> Cargando tu acceso…
    </div>
  );
}

function ContenidoSuscripcion() {
  const parametros = useSearchParams();
  const suscripcion = useSuscripcion();
  const checkout = useIniciarCheckout();
  const portal = useAbrirPortal();
  const [periodo, setPeriodo] = useState<'MENSUAL' | 'ANUAL'>('MENSUAL');

  if (suscripcion.isLoading) return <Cargando />;
  if (suscripcion.isError || !suscripcion.data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          No pudimos cargar tu suscripción. Recarga la página en unos momentos.
        </div>
      </div>
    );
  }

  const datos = suscripcion.data;
  const { entitlements } = datos;
  const accesoExpira = fechaLarga(datos.acceso_expira);
  const errorAccion = checkout.error ?? portal.error;
  const resultadoCheckout = parametros.get('checkout');

  return (
    <div className="max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Cuenta</p>
        <h1 className="mt-1 font-display text-3xl font-medium text-emerald-950">Plan y acceso</h1>
        <p className="mt-1 text-sm text-stone-500">Tu vigencia Pro y el consumo real del mes.</p>
      </div>

      {resultadoCheckout === 'exito' && (
        <Aviso tono="exito" icono={CheckCircle2}>
          Pago recibido. Actualizaremos tu vigencia cuando Stripe confirme el cobro.
        </Aviso>
      )}
      {resultadoCheckout === 'cancelado' && (
        <Aviso tono="neutro" icono={AlertTriangle}>
          Cancelaste el pago y no se hizo ningún cargo.
        </Aviso>
      )}
      {errorAccion && (
        <Aviso tono="error" icono={AlertTriangle}>
          {errorAccion.message}
        </Aviso>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Plan vigente"
          icon={CreditCard}
          action={
            datos.pagos_habilitados && datos.tiene_suscripcion_stripe ? (
              <Btn
                size="sm"
                variant="outline"
                disabled={portal.isPending}
                onClick={() => portal.mutate()}
              >
                {portal.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Settings size={14} />
                )}
                Gestionar
              </Btn>
            ) : undefined
          }
        >
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl font-medium text-emerald-950">
              {ETIQUETA_PLAN[datos.plan] ?? datos.plan}
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
              {ETIQUETA_ESTADO[datos.estado] ?? datos.estado}
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-stone-600">
            Tu acceso está activo hasta el{' '}
            <strong className="font-semibold text-emerald-950">{accesoExpira ?? '—'}</strong>.
          </p>
          <p className="mt-2 text-sm text-stone-500">
            PDF con tu marca, pacientes y plantillas ilimitadas incluidos.
          </p>
        </SectionCard>

        <SectionCard title="Uso de este mes" icon={Sparkles}>
          <BarraDeUso
            titulo="Generaciones de IA"
            sustantivo="generaciones"
            uso={{
              usados: entitlements.ia.usadas,
              limite: entitlements.ia.limite,
              restantes: entitlements.ia.restantes,
              alcanzado: entitlements.ia.agotada,
            }}
          />
          <p className="mt-4 text-xs leading-relaxed text-stone-400">
            La cuota se reinicia el primer día de cada mes.
          </p>
        </SectionCard>
      </div>

      {!datos.pagos_habilitados ? (
        <section className="relative overflow-hidden rounded-2xl bg-emerald-950 p-6 text-white sm:p-8">
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[24px] border-lime-300/10" />
          <div className="relative max-w-2xl">
            <Mail size={23} className="text-lime-300" />
            <h2 className="mt-4 font-display text-2xl">Renovación mensual</h2>
            <p className="mt-2 text-sm leading-relaxed text-emerald-100">
              Por ahora las renovaciones se confirman directamente con el equipo. Escríbenos después
              de realizar tu pago y activaremos un nuevo mes Pro.
            </p>
            <a
              href={`mailto:${datos.contacto_renovacion}?subject=${encodeURIComponent('Renovación de acceso Pro en nutria')}`}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-lime-200"
            >
              Contactar para renovar
            </a>
          </div>
        </section>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-medium text-emerald-950">
              Planes disponibles
            </h2>
            <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs">
              {(['MENSUAL', 'ANUAL'] as const).map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => setPeriodo(opcion)}
                  className={`rounded-md px-3 py-1.5 ${periodo === opcion ? 'bg-emerald-900 text-white' : 'text-stone-500'}`}
                >
                  {opcion === 'MENSUAL' ? 'Mensual' : 'Anual'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {datos.catalogo.map((plan) => (
              <TarjetaPlan
                key={plan.clave}
                plan={plan}
                periodo={periodo}
                esActual={plan.clave === datos.plan}
                contratando={checkout.isPending}
                onContratar={(elegido, precio) =>
                  checkout.mutate({
                    plan: elegido.clave as 'PRO' | 'CLINICA',
                    periodo: precio.periodo,
                  })
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type AvisoProps = {
  tono: 'exito' | 'error' | 'neutro';
  icono: typeof AlertTriangle;
  children: React.ReactNode;
};
const TONOS: Record<AvisoProps['tono'], string> = {
  exito: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-red-50 border-red-200 text-red-800',
  neutro: 'bg-stone-50 border-stone-200 text-stone-600',
};

function Aviso({ tono, icono: Icono, children }: AvisoProps) {
  return (
    <div className={`mb-4 flex gap-3 rounded-xl border p-4 text-sm ${TONOS[tono]}`}>
      <Icono size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
