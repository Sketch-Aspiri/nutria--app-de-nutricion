'use client';

import { useState } from 'react';
import { Download, ShieldAlert } from 'lucide-react';

import { AvisoError } from '@/components/ui/Pantalla';
import { Btn } from '@/components/ui/Btn';
import { inputClass, labelClass } from '@/components/ui/campos';

import { useDarDeBaja, useDescargarMisDatos } from './usePerfil';

/**
 * Derechos ARCO: acceso/portabilidad y cancelación (§9, fase 11).
 *
 * Las dos acciones viven juntas porque son el mismo derecho visto desde dos
 * lados, y porque a nadie se le debería pedir que se dé de baja sin tener al
 * lado el botón para llevarse sus datos primero.
 */
export function MisDatos({ onBaja }: { onBaja: () => void }) {
  const descarga = useDescargarMisDatos();

  return (
    <section className="mx-5 mt-6 lg:mx-0">
      <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-stone-400">
        Tus datos
      </h2>

      <div className="mt-2 overflow-hidden rounded-3xl border border-stone-200 bg-white">
        <button
          type="button"
          onClick={() => descarga.mutate()}
          disabled={descarga.isPending}
          className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-60"
        >
          <Download size={18} className="text-stone-400" aria-hidden />
          <span>
            {descarga.isPending ? 'Preparando tu archivo…' : 'Descargar mis datos'}
            <span className="mt-0.5 block text-[11px] leading-snug text-stone-400">
              Un archivo JSON con lo que registraste y lo que tu nutrióloga te compartió.
            </span>
          </span>
        </button>

        {descarga.isError && (
          <p role="alert" className="border-t border-stone-100 px-5 py-3 text-xs text-red-700">
            {descarga.error.message}
          </p>
        )}
        {descarga.isSuccess && (
          <p role="status" className="border-t border-stone-100 px-5 py-3 text-xs text-emerald-700">
            Listo: revisa las descargas de tu teléfono.
          </p>
        )}
      </div>

      {/*
        Lo que el archivo NO trae se dice aquí y también dentro del propio JSON.
        Un paciente que cree tener su expediente completo y no lo tiene es peor
        que uno que sabe a quién pedírselo.
      */}
      <p className="mt-2 px-1 text-[11px] leading-relaxed text-stone-400">
        Las notas de consulta y tu expediente clínico los resguarda tu nutrióloga, que es su
        responsable. Pídeselos directamente si los necesitas completos.
      </p>

      <DarseDeBaja onBaja={onBaja} />
    </section>
  );
}

/**
 * Baja de la cuenta.
 *
 * La confirmación es de dos pasos y pide la contraseña: es la única acción
 * irreversible de la app. El texto dice **qué se va y qué se queda** antes de
 * que el paciente escriba nada — descubrir después que el expediente sigue con
 * la nutrióloga sería una sorpresa, y en datos de salud las sorpresas se pagan
 * caro.
 */
function DarseDeBaja({ onBaja }: { onBaja: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState('');
  const baja = useDarDeBaja();

  const confirmar = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!password) return;
    baja.mutate(password, { onSuccess: onBaja });
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-4 flex w-full items-center gap-3 rounded-3xl border border-stone-200 bg-white px-5 py-4 text-left text-sm text-red-700 hover:bg-red-50"
      >
        <ShieldAlert size={18} className="text-red-400" aria-hidden />
        Dar de baja mi cuenta
      </button>
    );
  }

  return (
    <form onSubmit={confirmar} className="mt-4 rounded-3xl border border-red-200 bg-white p-5">
      <h3 className="flex items-center gap-2 text-sm font-medium text-red-800">
        <ShieldAlert size={16} aria-hidden />
        Dar de baja mi cuenta
      </h3>

      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-stone-600">
        <li>· Perderás el acceso a la app y no podrás volver a entrar con este correo.</li>
        <li>· Se borra tu cuenta de acceso: usuario y contraseña.</li>
        <li>
          · <strong>Tu expediente clínico permanece con tu nutrióloga</strong>, que es su
          responsable. Se le avisará de tu baja.
        </li>
        <li>· Para cancelar también el expediente, pídeselo a ella por el aviso de privacidad.</li>
      </ul>

      <p className="mt-3 text-xs font-medium text-stone-700">
        Descarga tus datos antes de continuar: después ya no podrás hacerlo desde aquí.
      </p>

      {baja.isError && (
        <div className="mt-4">
          <AvisoError mensaje={baja.error.message} />
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="password-baja" className={labelClass}>
          Escribe tu contraseña para confirmar
        </label>
        <input
          id="password-baja"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
          className={inputClass}
        />
      </div>

      <div className="mt-5 flex gap-2">
        <Btn
          variant="ghost"
          onClick={() => {
            setPassword('');
            setAbierto(false);
          }}
          className="flex-1 border border-stone-200"
        >
          Mejor no
        </Btn>
        <Btn
          type="submit"
          disabled={!password || baja.isPending}
          className="flex-1 bg-red-700 hover:bg-red-800"
        >
          {baja.isPending ? 'Dando de baja…' : 'Sí, dar de baja'}
        </Btn>
      </div>
    </form>
  );
}
