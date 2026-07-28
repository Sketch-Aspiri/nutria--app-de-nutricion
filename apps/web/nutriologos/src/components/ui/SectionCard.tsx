import type { LucideIcon } from 'lucide-react';

type SectionCardProps = {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
};

export function SectionCard({ title, icon: Icon, children, action }: SectionCardProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-400">
          {Icon && <Icon size={14} />} {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
