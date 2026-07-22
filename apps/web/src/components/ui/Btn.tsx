type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'outline';
  disabled?: boolean;
  size?: 'md' | 'sm';
  className?: string;
  /** `submit` deja que el formulario se envíe con Enter. */
  type?: 'button' | 'submit';
};

export function Btn({
  children,
  onClick,
  variant = 'primary',
  disabled,
  size = 'md',
  className = '',
  type = 'button',
}: BtnProps) {
  const base = 'inline-flex items-center gap-2 rounded-lg transition-colors disabled:opacity-50 font-medium';
  const sizes = { md: 'text-sm px-4 py-2.5', sm: 'text-xs px-3 py-2' };
  const variants = {
    primary: 'bg-emerald-900 text-white hover:bg-emerald-800',
    ghost: 'text-stone-500 hover:bg-stone-100',
    outline: 'border border-emerald-800 text-emerald-800 hover:bg-emerald-50',
  };
  return (
    <button
      // eslint-disable-next-line react/button-has-type
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
