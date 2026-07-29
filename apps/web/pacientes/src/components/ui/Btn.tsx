type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'claro';
  disabled?: boolean;
  className?: string;
  /** `submit` deja que el formulario se envíe con Enter. */
  type?: 'button' | 'submit';
};

/**
 * Botón de la app del paciente. Hermano del `Btn` del panel, no el mismo: allá
 * los botones son de escritorio y conviven cuatro en una fila; aquí son de
 * pulgar y casi siempre ocupan el ancho.
 */
export function Btn({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  type = 'button',
}: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors disabled:opacity-50';
  const variants = {
    primary: 'bg-emerald-900 text-white hover:bg-emerald-800',
    ghost: 'text-stone-500 hover:bg-stone-100',
    // Sobre el verde profundo de las pantallas de acceso.
    claro: 'bg-white text-emerald-950 hover:bg-stone-100',
  };

  return (
    <button
      // eslint-disable-next-line react/button-has-type
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
