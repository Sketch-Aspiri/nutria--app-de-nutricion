import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/**
 * Andamio común de las pantallas con navegación: encabezado, contenido y el
 * hueco que deja la barra inferior.
 *
 * Vive en un solo lugar porque el margen inferior es fácil de olvidar y su
 * síntoma —la última tarjeta tapada por la navegación— solo se ve al hacer
 * scroll hasta abajo en un teléfono real.
 */
export function Pantalla({
  titulo,
  subtitulo,
  accion,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen pb-nav">
      <header className="flex items-start justify-between px-5 pt-8 pb-5">
        <div>
          <h1 className="font-display text-2xl font-medium leading-tight text-emerald-950">
            {titulo}
          </h1>
          {subtitulo && <p className="mt-0.5 text-xs text-stone-400">{subtitulo}</p>}
        </div>
        {accion}
      </header>
      {children}
    </main>
  );
}

/**
 * Estado vacío.
 *
 * En esta fase es lo único que muestran las pantallas, y el texto lo dice sin
 * rodeos: no hay datos de ejemplo ni cifras inventadas. Un cero o una gráfica
 * de mentira en una app de salud se lee como información sobre uno mismo.
 */
export function EstadoVacio({
  icono: Icono,
  titulo,
  descripcion,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="mx-5 flex flex-col items-center rounded-3xl border border-stone-200 bg-white px-6 py-12 text-center">
      <div className="rounded-full bg-stone-100 p-3 text-stone-400">
        <Icono size={22} aria-hidden />
      </div>
      <p className="mt-4 text-sm font-medium text-emerald-950">{titulo}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-stone-500">{descripcion}</p>
    </div>
  );
}

/** Encabezado de las pantallas de acceso: fondo verde, sin navegación. */
export function PantallaAcceso({
  titulo,
  descripcion,
  children,
  pie,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col bg-emerald-950 px-6 pb-10 pt-16 text-white">
      <Link href="/" className="font-display text-3xl font-medium">
        nutria
      </Link>
      <p className="mt-1 text-sm text-emerald-300">{descripcion}</p>

      <div className="mt-10 rounded-3xl bg-white p-6 text-stone-800">
        <h1 className="font-display text-xl font-medium text-emerald-950">{titulo}</h1>
        <div className="mt-5">{children}</div>
      </div>

      {pie && <div className="mt-6 text-center text-xs text-emerald-300">{pie}</div>}
    </main>
  );
}

/** Aviso de error de formulario, con `role` para que el lector lo anuncie. */
export function AvisoError({ mensaje }: { mensaje: string }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"
    >
      {mensaje}
    </p>
  );
}
