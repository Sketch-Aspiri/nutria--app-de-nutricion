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
    <main className="min-h-screen pb-nav lg:mx-auto lg:max-w-3xl lg:px-8 lg:pb-16">
      <header className="flex items-start justify-between px-5 pt-8 pb-5 lg:px-0">
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
    <div className="mx-5 flex flex-col items-center rounded-3xl border border-stone-200 bg-white px-6 py-12 text-center lg:mx-0">
      <div className="rounded-full bg-stone-100 p-3 text-stone-400">
        <Icono size={22} aria-hidden />
      </div>
      <p className="mt-4 text-sm font-medium text-emerald-950">{titulo}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-stone-500">{descripcion}</p>
    </div>
  );
}

/**
 * Encabezado de las pantallas de acceso: fondo verde, sin navegación.
 *
 * En celular es una sola columna verde de arriba abajo — marca, descripción y
 * la tarjeta blanca del formulario, en ese orden. En escritorio (`lg:`) deja
 * de ser esa misma tarjeta encogida y centrada en medio del vacío: se parte
 * en dos paneles de ancho completo, marca a la izquierda y formulario a la
 * derecha, cada uno ocupando la altura entera de la pantalla.
 */
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
    <main className="flex min-h-screen flex-col bg-emerald-950 px-6 pb-10 pt-16 text-white lg:flex-row lg:px-0 lg:pb-0 lg:pt-0">
      <div className="lg:flex lg:w-1/2 lg:flex-col lg:justify-center lg:px-16 lg:py-16">
        <Link href="/" className="font-display text-3xl font-medium lg:text-4xl">
          nutria
        </Link>
        <p className="mt-1 text-sm text-emerald-300 lg:mt-3 lg:max-w-sm lg:text-base">
          {descripcion}
        </p>
      </div>

      <div className="lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center lg:bg-stone-50 lg:px-16 lg:py-16">
        <div className="mt-10 rounded-3xl bg-white p-6 text-stone-800 lg:mt-0 lg:w-full lg:max-w-sm lg:p-8 lg:shadow-xl lg:shadow-emerald-950/5 lg:ring-1 lg:ring-stone-200">
          <h1 className="font-display text-xl font-medium text-emerald-950">{titulo}</h1>
          <div className="mt-5">{children}</div>
        </div>

        {pie && (
          <div className="mt-6 text-center text-xs text-emerald-300 lg:text-stone-400">{pie}</div>
        )}
      </div>
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
