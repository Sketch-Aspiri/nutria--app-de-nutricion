'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';

import { AvisoError } from '@/components/ui/Pantalla';
import { Btn } from '@/components/ui/Btn';
import { inputClass, labelClass } from '@/components/ui/campos';

import { MENSAJE_PASSWORD, PASSWORD_MIN, validarPassword } from './calculos';
import { useCambiarPassword } from './usePerfil';

/**
 * Cambio de contraseña.
 *
 * Pide la actual porque el servidor la exige: sin ese paso, una sesión robada o
 * un teléfono prestado bastaría para dejar al dueño fuera de su propia cuenta.
 *
 * Los campos van en un `<form>` con `autoComplete` correcto para que el gestor
 * de contraseñas del teléfono ofrezca guardar la nueva. Un cambio que el
 * gestor no registra termina en un paciente que no puede volver a entrar.
 */
export function CambiarPassword() {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [problema, setProblema] = useState<string | null>(null);
  const cambio = useCambiarPassword();

  const limpiar = () => {
    setActual('');
    setNueva('');
    setConfirmacion('');
    setProblema(null);
  };

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();
    const falla = validarPassword(actual, nueva, confirmacion);
    if (falla) {
      setProblema(MENSAJE_PASSWORD[falla]);
      return;
    }

    setProblema(null);
    cambio.mutate(
      { actual, nueva },
      {
        onSuccess: () => {
          limpiar();
          setAbierto(false);
        },
      },
    );
  };

  if (!abierto) {
    return (
      <div className="mx-5 mt-4 overflow-hidden rounded-3xl border border-stone-200 bg-white">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm text-stone-700 hover:bg-stone-50"
        >
          <KeyRound size={18} className="text-stone-400" aria-hidden />
          Cambiar mi contraseña
        </button>
        {cambio.isSuccess && (
          <p role="status" className="px-5 pb-4 text-xs text-emerald-700">
            Tu contraseña quedó actualizada.
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="mx-5 mt-4 rounded-3xl border border-stone-200 bg-white p-5"
    >
      <h2 className="flex items-center gap-2 text-sm font-medium text-emerald-950">
        <KeyRound size={16} className="text-emerald-800" aria-hidden />
        Cambiar mi contraseña
      </h2>

      <div className="mt-4">
        {problema && <AvisoError mensaje={problema} />}
        {cambio.isError && <AvisoError mensaje={cambio.error.message} />}
      </div>

      <div>
        <label htmlFor="actual" className={labelClass}>
          Contraseña actual
        </label>
        <input
          id="actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(evento) => setActual(evento.target.value)}
          className={inputClass}
        />
      </div>

      <div className="mt-3">
        <label htmlFor="nueva" className={labelClass}>
          Nueva contraseña (mínimo {PASSWORD_MIN} caracteres)
        </label>
        <input
          id="nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(evento) => setNueva(evento.target.value)}
          className={inputClass}
        />
      </div>

      <div className="mt-3">
        <label htmlFor="confirmacion" className={labelClass}>
          Repite la nueva contraseña
        </label>
        <input
          id="confirmacion"
          type="password"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(evento) => setConfirmacion(evento.target.value)}
          className={inputClass}
        />
      </div>

      <div className="mt-5 flex gap-2">
        <Btn type="submit" disabled={cambio.isPending} className="flex-1">
          {cambio.isPending ? 'Guardando…' : 'Guardar'}
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => {
            limpiar();
            setAbierto(false);
          }}
        >
          Cancelar
        </Btn>
      </div>
    </form>
  );
}
