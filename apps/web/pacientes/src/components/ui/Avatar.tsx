import Link from 'next/link';

/** Iniciales de un nombre, como en el prototipo. */
export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');
}

/** Acceso al perfil desde el encabezado, igual que en el prototipo. */
export function AvatarPerfil({ nombre }: { nombre: string }) {
  return (
    <Link
      href="/perfil"
      aria-label="Tu perfil"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-sm font-medium text-white"
    >
      {iniciales(nombre) || '·'}
    </Link>
  );
}
