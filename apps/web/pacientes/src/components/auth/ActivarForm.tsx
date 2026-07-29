'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Btn } from '@/components/ui/Btn';
import { inputClass, labelClass } from '@/components/ui/campos';
import { AvisoError, PantallaAcceso } from '@/components/ui/Pantalla';

const PASSWORD_MIN = 10;

/**
 * Define la contraseña y crea la cuenta del paciente a partir del token que
 * llegó por correo (§6.1 del plan).
 *
 * El token viaja en la query porque así lo construye el enlace del correo, y de
 * ahí al cuerpo del POST: nunca se guarda en el cliente ni se mete en el
 * historial de navegación más allá de esa carga.
 */
export function ActivarForm({ version }: { version: string }) {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const activar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError('');

    // Las dos comprobaciones locales existen para responder sin ida y vuelta;
    // el servidor las repite, que es donde de verdad cuentan.
    if (password.length < PASSWORD_MIN) {
      setError(`Tu contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
      return;
    }
    if (password !== confirmacion) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await fetch('/api/v1/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, acepta_privacidad: acepta }),
      });

      if (!respuesta.ok) {
        const cuerpo = (await respuesta.json()) as { error?: { message?: string } };
        setError(cuerpo.error?.message ?? 'No pudimos activar tu cuenta.');
        return;
      }

      // No se inicia sesión automáticamente: que el paciente escriba una vez
      // la contraseña que acaba de elegir es lo que hace que la recuerde.
      router.push('/entrar?activada=1');
    } catch {
      setError('No pudimos conectar. Revisa tu señal e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (!token) {
    return (
      <PantallaAcceso
        titulo="Falta el enlace de tu invitación"
        descripcion="Tu plan, tu progreso y tu nutrióloga, siempre contigo."
      >
        <p className="text-sm leading-relaxed text-stone-600">
          Abre el enlace tal como te llegó al correo. Si ya no lo tienes, pídele a tu nutrióloga
          que te reenvíe la invitación.
        </p>
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso
      titulo="Crea tu contraseña"
      descripcion="Tu plan, tu progreso y tu nutrióloga, siempre contigo."
      pie={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link href="/entrar" className="font-medium text-white underline">
            Entra aquí
          </Link>
        </>
      }
    >
      {error && <AvisoError mensaje={error} />}

      <form onSubmit={activar} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={PASSWORD_MIN}
            autoComplete="new-password"
            value={password}
            onChange={(evento) => setPassword(evento.target.value)}
            className={inputClass}
          />
          <p className="mt-1.5 text-[11px] text-stone-400">Mínimo {PASSWORD_MIN} caracteres.</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="confirmacion">
            Repite tu contraseña
          </label>
          <input
            id="confirmacion"
            type="password"
            required
            autoComplete="new-password"
            value={confirmacion}
            onChange={(evento) => setConfirmacion(evento.target.value)}
            className={inputClass}
          />
        </div>

        <label className="flex items-start gap-3 text-xs leading-relaxed text-stone-600">
          <input
            type="checkbox"
            required
            checked={acepta}
            onChange={(evento) => setAcepta(evento.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 accent-emerald-800"
          />
          <span>
            He leído y acepto el{' '}
            <Link href="/privacidad" className="font-medium text-emerald-800 underline">
              aviso de privacidad
            </Link>{' '}
            <span className="font-mono text-[11px] text-stone-400">{version}</span>
          </span>
        </label>

        <Btn type="submit" disabled={enviando} className="w-full">
          {enviando ? 'Creando tu cuenta…' : 'Crear mi cuenta'}
        </Btn>
      </form>
    </PantallaAcceso>
  );
}
