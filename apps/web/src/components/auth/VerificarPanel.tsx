'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { AuthCard, AuthError } from '@/components/auth/AuthCard';
import { Btn } from '@/components/ui/Btn';
import { inputClass, labelClass } from '@/components/ui/campos';

type Estado = 'sin_token' | 'verificando' | 'listo' | 'fallo';

export function VerificarPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [estado, setEstado] = useState<Estado>(token ? 'verificando' : 'sin_token');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [reenviado, setReenviado] = useState(false);
  // Evita una segunda llamada al montar dos veces en modo estricto de React.
  const yaIntento = useRef(false);

  useEffect(() => {
    if (!token || yaIntento.current) return;
    yaIntento.current = true;

    const verificar = async () => {
      try {
        const respuesta = await fetch('/api/v1/auth/verify_email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!respuesta.ok) {
          const cuerpo = (await respuesta.json()) as { error?: { message: string } };
          setError(cuerpo.error?.message ?? 'No pudimos confirmar tu correo.');
          setEstado('fallo');
          return;
        }
        setEstado('listo');
        // La sesión anterior (si existía) trae el correo como no verificado;
        // se cierra para que el siguiente inicio de sesión emita un token al día.
        await signOut({ redirect: false });
        router.replace('/login?verificado=1');
      } catch {
        setError('No pudimos conectar con el servidor. Intenta de nuevo.');
        setEstado('fallo');
      }
    };

    void verificar();
  }, [token, router]);

  const reenviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError('');
    try {
      await fetch('/api/v1/auth/resend_verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setReenviado(true);
    } catch {
      setError('No pudimos conectar con el servidor. Intenta de nuevo.');
    }
  };

  if (estado === 'verificando' || estado === 'listo') {
    return (
      <AuthCard
        titulo="Confirmando tu correo…"
        descripcion="Esto toma solo un momento."
      >
        <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-emerald-700 animate-pulse" />
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titulo="Confirma tu correo"
      descripcion="Para entrar al panel necesitas confirmar tu dirección. Si el enlace venció, te enviamos uno nuevo."
      pie={
        <Link href="/login" className="text-emerald-800 font-medium hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {error && <AuthError mensaje={error} />}
      {reenviado ? (
        <div
          role="status"
          className="bg-lime-50 border border-lime-200 text-emerald-900 text-xs rounded-lg px-3 py-2.5"
        >
          Si la cuenta existe y está pendiente de verificar, acabamos de enviar un nuevo enlace.
        </div>
      ) : (
        <form onSubmit={reenviar} className="space-y-3">
          <div>
            <label className={labelClass} htmlFor="email">
              Tu correo
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <Btn type="submit" className="w-full justify-center">
            Reenviar enlace
          </Btn>
        </form>
      )}
    </AuthCard>
  );
}
