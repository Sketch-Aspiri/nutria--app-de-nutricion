'use client';

import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
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

/**
 * Página de suscripción: plan vigente, consumo del mes y catálogo.
 *
 * Todo lo que se ve aquí viene del servidor —incluido si un plan se puede
 * contratar— porque los topes se aplican allá. Esta vista solo los explica.
 */

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
      <Loader2 size={16} className="animate-spin" /> Cargando tu suscripción…
    </div>
  );
}

function ContenidoSuscripcion() {
  const parametros = useSearchParams();
  const suscripcion = useSuscripcion();
  const checkout = useIniciarCheckout();
  const portal = useAbrirPortal();
  const [periodo, setPeriodo] = useState<'MENSUAL' | 'ANUAL'>('MENSUAL');

  const resultadoCheckout = parametros.get('checkout');

  if (suscripcion.isLoading) return <Cargando />;

  if (suscripcion.isError || !suscripcion.data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
          No pudimos cargar tu suscripción. Recarga la página en unos momentos.
        </div>
      </div>
    );
  }

  const datos = suscripcion.data;
  const { entitlements } = datos;
  const beta = datos.modo === 'beta';
  const finPeriodo = fechaLarga(datos.periodo_fin);
  const errorAccion = checkout.error ?? portal.error;

  return (
    <div className="max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-emerald-950 font-medium">Suscripción</h1>
        <div className="text-stone-500 text-sm mt-1">
          Tu plan, lo que llevas usado este mes y las opciones disponibles.
        </div>
      </div>

      {resultadoCheckout === 'exito' && (
        <Aviso tono="exito" icono={CheckCircle2}>
          Pago recibido. Tu plan se actualiza en cuanto Stripe nos confirme el cobro; si aquí
          arriba todavía dice Free, recarga en unos segundos.
        </Aviso>
      )}
      {resultadoCheckout === 'cancelado' && (
        <Aviso tono="neutro" icono={AlertTriangle}>
          Cancelaste el pago. No se te cobró nada y tu plan sigue igual.
        </Aviso>
      )}

      {beta && (
        <Aviso tono="beta" icono={Sparkles}>
          <strong className="font-medium">Estás en la beta de nutria.</strong> Todas las cuentas
          son gratuitas y <strong className="font-medium">sin límites</strong>: pacientes,
          plantillas y generaciones de IA ilimitadas, y PDF con tu marca incluido. Los planes de
          abajo son los que entrarán en vigor cuando termine la beta; te avisaremos antes de que
          cambie nada.
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
            datos.tiene_suscripcion_stripe ? (
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
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl text-emerald-950 font-medium">
              {ETIQUETA_PLAN[datos.plan] ?? datos.plan}
            </span>
            <span className="text-xs text-stone-500">
              {beta ? 'Beta sin límites' : (ETIQUETA_ESTADO[datos.estado] ?? datos.estado)}
            </span>
          </div>

          <div className="mt-3 space-y-1 text-sm text-stone-500">
            {datos.estado === 'PAST_DUE' && (
              <p className="text-amber-700">
                No pudimos cobrar tu última factura. Actualiza tu tarjeta desde Gestionar antes de
                que se suspenda el plan.
              </p>
            )}
            {finPeriodo && (
              <p>
                {datos.cancela_al_final
                  ? `Tu plan termina el ${finPeriodo} y la cuenta vuelve a Free.`
                  : `Próxima renovación: ${finPeriodo}.`}
              </p>
            )}
            {!datos.tiene_suscripcion_stripe && !beta && (
              <p>Estás en el plan base. Contrata uno de abajo para ampliar los límites.</p>
            )}
            <p>
              PDF con tu marca:{' '}
              <span className="text-stone-700">
                {entitlements.marca_blanca ? 'incluido' : 'no incluido en este plan'}
              </span>
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Uso de este mes" icon={Sparkles}>
          <div className="space-y-4">
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
            <BarraDeUso
              titulo="Pacientes activos"
              sustantivo="pacientes"
              uso={entitlements.pacientes}
            />
            <BarraDeUso
              titulo="Plantillas guardadas"
              sustantivo="plantillas"
              uso={entitlements.plantillas}
            />
          </div>
          <p className="text-xs text-stone-400 mt-4">
            Las generaciones de IA se reinician el primer día de cada mes.
          </p>
        </SectionCard>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-emerald-950 font-medium">Planes</h2>
        <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs">
          {(['MENSUAL', 'ANUAL'] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setPeriodo(opcion)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                periodo === opcion
                  ? 'bg-emerald-900 text-white'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {opcion === 'MENSUAL' ? 'Mensual' : 'Anual'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <p className="text-xs text-stone-400 mt-5 leading-relaxed">
        Los pagos los procesa Stripe; nutria nunca ve ni guarda los datos de tu tarjeta. Los
        precios incluyen IVA calculado por Stripe Tax. El recibo llega a tu correo; la factura
        CFDI 4.0 estará disponible más adelante.
      </p>
    </div>
  );
}

type AvisoProps = {
  tono: 'exito' | 'error' | 'beta' | 'neutro';
  icono: typeof AlertTriangle;
  children: React.ReactNode;
};

const TONOS: Record<AvisoProps['tono'], string> = {
  exito: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-red-50 border-red-200 text-red-800',
  beta: 'bg-lime-50 border-lime-300 text-emerald-900',
  neutro: 'bg-stone-50 border-stone-200 text-stone-600',
};

function Aviso({ tono, icono: Icono, children }: AvisoProps) {
  return (
    <div className={`border rounded-xl p-4 mb-4 flex gap-3 text-sm ${TONOS[tono]}`}>
      <Icono size={18} className="shrink-0 mt-0.5" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
