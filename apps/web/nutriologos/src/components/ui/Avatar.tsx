type AvatarProps = {
  foto: string | null;
  nombre: string;
  size?: number;
};

export function Avatar({ foto, nombre, size = 56 }: AvatarProps) {
  if (foto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URLs subidas por el usuario
      <img
        src={foto}
        alt={nombre}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 border border-stone-200"
      />
    );
  }
  const iniciales = nombre
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      className="rounded-full bg-emerald-900 text-lime-300 flex items-center justify-center shrink-0 font-medium"
    >
      {iniciales}
    </div>
  );
}
