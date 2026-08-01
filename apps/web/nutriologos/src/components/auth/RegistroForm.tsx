'use client';

import Link from 'next/link';
import { useState } from 'react';

import { AuthCard, AuthError } from '@/components/auth/AuthCard';
import { Btn } from '@/components/ui/Btn';
import { inputClass, labelClass } from '@/components/ui/campos';

const PASSWORD_MIN = 10;

type RespuestaRegistro = {
  email?: string;
  verificacion_enviada?: boolean;
  enlace_verificacion_dev?: string;
  error?: { code: string; message: string };
};

export function RegistroForm() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cedula, setCedula] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [alta, setAlta] = useState<RespuestaRegistro | null>(null);

  const registrar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const respuesta = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: nombre,
          email,
          password,
          cedula_profesional: cedula || undefined,
          acepta_aviso_privacidad: acepta,
        }),
      });
      const cuerpo = (await respuesta.json()) as RespuestaRegistro;
      if (!respuesta.ok) {
        setError(cuerpo.error?.message ?? 'No pudimos crear la cuenta. Intenta de nuevo.');
        return;
      }
      setAlta(cuerpo);
    } catch {
      setError('No pudimos conectar con el servidor. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (alta) {
    return (
      <AuthCard
        titulo="Revisa tu correo"
        descripcion={`Enviamos un enlace de confirmación a ${alta.email}. Tiene una vigencia de 24 horas.`}
        pie={
          <Link href="/login" className="text-emerald-800 font-medium hover:underline">
            Ir a iniciar sesión
          </Link>
        }
      >
        {alta.enlace_verificacion_dev && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-900 break-all">
            <strong className="block mb-1">Modo desarrollo (sin proveedor de correo)</strong>
            <Link href={alta.enlace_verificacion_dev} className="underline">
              {alta.enlace_verificacion_dev}
            </Link>
          </div>
        )}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titulo="Crea tu cuenta de nutriólogo"
      descripcion="Empieza gratis con hasta 3 pacientes. Sin tarjeta."
      pie={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-emerald-800 font-medium hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      {error && <AuthError mensaje={error} />}

      <form onSubmit={registrar} className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="nombre">
            Nombre completo
          </label>
          <input
            id="nombre"
            required
            autoComplete="name"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={inputClass}
          />
        </div>
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
            Contraseña (mínimo {PASSWORD_MIN} caracteres)
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={PASSWORD_MIN}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="cedula">
            Cédula profesional (opcional)
          </label>
          <input
            id="cedula"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            className={inputClass}
          />
        </div>
        <label className="flex items-start gap-2 text-xs text-stone-500 leading-relaxed pt-1">
          <input
            type="checkbox"
            required
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Acepto el{' '}
            <Link
              href="/privacidad#profesionales"
              target="_blank"
              className="font-medium text-emerald-800 underline underline-offset-2"
            >
              aviso de privacidad
            </Link>{' '}
            y me comprometo a tratar los datos de salud de mis pacientes conforme a la
            LFPDPPP.
          </span>
        </label>
        <Btn type="submit" disabled={enviando} className="w-full justify-center">
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </Btn>
      </form>
    </AuthCard>
  );
}
