import Link from 'next/link';

type AuthCardProps = {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
};

/** Marco compartido por las pantallas de acceso, alta y verificación. */
export function AuthCard({ titulo, descripcion, children, pie }: AuthCardProps) {
  return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
      <div className="bg-stone-50 rounded-2xl max-w-sm w-full p-8">
        <div className="text-center">
          <Link href="/" className="font-display text-3xl text-emerald-950 font-medium">
            nutria
          </Link>
          <h1 className="text-stone-800 text-sm font-medium mt-4">{titulo}</h1>
          {descripcion && <p className="text-stone-500 text-xs mt-1.5 leading-relaxed">{descripcion}</p>}
        </div>
        <div className="mt-6">{children}</div>
        {pie && <div className="text-center text-xs text-stone-500 mt-5">{pie}</div>}
      </div>
    </div>
  );
}

export function AuthError({ mensaje }: { mensaje: string }) {
  return (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-3 py-2.5 mb-4"
    >
      {mensaje}
    </div>
  );
}
