type ChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

export function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
        active
          ? 'bg-emerald-900 text-white border-emerald-900'
          : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-300'
      }`}
    >
      {label}
    </button>
  );
}
