'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { AuthCard, AuthError } from '@/components/auth/AuthCard';
import { Btn } from '@/components/ui/Btn';
import { inputClass, labelClass } from '@/components/ui/campos';

const DESTINO_POR_DEFECTO = '/pacientes';

export function LoginForm({ googleHabilitado }: { googleHabilitado: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const verificado = searchParams.get('verificado') === '1';
  const destino = searchParams.get('callbackUrl') ?? DESTINO_POR_DEFECTO;

  const entrar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const resultado = await signIn('credentials', { email, password, redirect: false });
      if (resultado?.error) {
        // Mensaje genérico a propósito: no revela si el correo existe.
        setError('Correo o contraseña incorrectos.');
        return;
      }
      // Si el correo aún no está verificado, el middleware manda a /verificar.
      router.push(destino);
      router.refresh();
    } catch {
      setError('No pudimos conectar con el servidor. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AuthCard
      titulo="Entra a tu panel"
      descripcion="Tus pacientes, planes y seguimiento — con IA integrada."
      pie={
        <>
          ¿Todavía no tienes cuenta?{' '}
          <Link href="/registro" className="text-emerald-800 font-medium hover:underline">
            Crea una gratis
          </Link>
        </>
      }
    >
      {verificado && (
        <div
          role="status"
          className="bg-lime-50 border border-lime-200 text-emerald-900 text-xs rounded-lg px-3 py-2.5 mb-4"
        >
          Tu correo quedó confirmado. Inicia sesión para continuar.
        </div>
      )}
      {error && <AuthError mensaje={error} />}

      <form onSubmit={entrar} className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="tu@consultorio.mx"
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
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <Btn type="submit" disabled={enviando} className="w-full justify-center">
          {enviando ? 'Entrando…' : 'Iniciar sesión'}
        </Btn>
      </form>

      {googleHabilitado && (
        <>
          <div className="text-center text-xs text-stone-400 my-4">o</div>
          <Btn
            variant="outline"
            className="w-full justify-center"
            onClick={() => void signIn('google', { redirectTo: destino })}
          >
            Continuar con Google
          </Btn>
        </>
      )}
    </AuthCard>
  );
}
