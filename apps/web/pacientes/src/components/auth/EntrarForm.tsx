'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Btn } from '@/components/ui/Btn';
import { inputClass, labelClass } from '@/components/ui/campos';
import { AvisoError, PantallaAcceso } from '@/components/ui/Pantalla';

const DESTINO_POR_DEFECTO = '/';

/** Motivos con los que el middleware puede mandar de vuelta a esta pantalla. */
const MENSAJES: Record<string, string> = {
  sin_acceso:
    'Esa cuenta es de un nutriólogo. Entra con la cuenta que activaste desde la invitación.',
};

export function EntrarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(MENSAJES[searchParams.get('error') ?? ''] ?? '');
  const [enviando, setEnviando] = useState(false);

  const activada = searchParams.get('activada') === '1';
  const destino = searchParams.get('callbackUrl') ?? DESTINO_POR_DEFECTO;

  const entrar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const resultado = await signIn('credentials', { email, password, redirect: false });
      if (resultado?.error) {
        // Genérico a propósito: no revela si el correo existe. La comprobación
        // de que la cuenta sea de un paciente la hace el middleware.
        setError('Correo o contraseña incorrectos.');
        return;
      }
      router.push(destino);
      router.refresh();
    } catch {
      setError('No pudimos conectar. Revisa tu señal e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PantallaAcceso
      titulo="Entra a tu app"
      descripcion="Tu plan, tu progreso y tu nutrióloga, siempre contigo."
      pie="¿No tienes cuenta? Tu nutrióloga te envía la invitación por correo."
    >
      {activada && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-lime-200 bg-lime-50 px-3 py-2.5 text-xs text-emerald-900"
        >
          Tu cuenta quedó lista. Entra con tu correo y tu contraseña.
        </p>
      )}
      {error && <AvisoError mensaje={error} />}

      <form onSubmit={entrar} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            className={inputClass}
            placeholder="tu@correo.mx"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(evento) => setPassword(evento.target.value)}
            className={inputClass}
          />
        </div>
        <Btn type="submit" disabled={enviando} className="w-full">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Btn>
      </form>
    </PantallaAcceso>
  );
}
