import { X } from 'lucide-react';

type ChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  /**
   * Muestra una × y describe la acción como "quitar". Para valores escritos por
   * el usuario, donde desmarcar equivale a borrarlos de la lista.
   */
  removable?: boolean;
};

export function Chip({ label, active, onClick, removable }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={removable ? `Quitar ${label}` : undefined}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
        active
          ? 'bg-emerald-900 text-white border-emerald-900'
          : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-300'
      }`}
    >
      {label}
      {removable && <X size={12} aria-hidden="true" />}
    </button>
  );
}
