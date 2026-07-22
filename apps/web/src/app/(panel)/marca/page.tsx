'use client';

import { Camera, CheckCircle2, Palette, ShieldCheck } from 'lucide-react';

import { colors } from '@nutria/ui-tokens';

import { SectionCard } from '@/components/ui/SectionCard';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';
import { useAppState } from '@/store/app-state';

const CUMPLIMIENTO = [
  'Datos cifrados en tránsito y en reposo',
  'Aviso de privacidad conforme a LFPDPPP (México)',
  'Exportación de expedientes al cancelar la suscripción',
  'Estructura alineable a NOM-004-SSA3',
];

export default function MarcaPage() {
  const { marca, setMarca } = useAppState();

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () =>
      setMarca((m) => ({ ...m, logo: typeof r.result === 'string' ? r.result : null }));
    r.readAsDataURL(f);
  };

  return (
    <div className="p-8 max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl text-emerald-950 font-medium">Marca y datos</h1>
        <div className="text-stone-500 text-sm mt-1">
          Tu identidad en los PDF y el portal del paciente (marca blanca)
        </div>
      </div>
      <SectionCard title="Identidad" icon={Palette}>
        <div className="flex items-center gap-4 mb-4">
          {marca.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo subido como data URL
            <img src={marca.logo} alt="logo" className="w-16 h-16 object-contain rounded-lg border border-stone-200" />
          ) : (
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-xl font-medium"
              style={{ background: marca.color }}
            >
              {(marca.nombre || 'N')[0]}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-emerald-800 border border-emerald-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-emerald-50">
            <Camera size={14} /> Subir logo
            <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
          </label>
        </div>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Nombre del consultorio / marca</label>
            <input
              className={inp}
              value={marca.nombre}
              onChange={(e) => setMarca((m) => ({ ...m, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className={lbl}>Nombre profesional</label>
            <input
              className={inp}
              value={marca.profesional}
              onChange={(e) => setMarca((m) => ({ ...m, profesional: e.target.value }))}
            />
          </div>
          <div>
            <label className={lbl}>Color de marca</label>
            <div className="flex gap-2">
              {colors.brandPalette.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setMarca((m) => ({ ...m, color: c }))}
                  className={`w-8 h-8 rounded-full ${marca.color === c ? 'ring-2 ring-offset-2 ring-stone-400' : ''}`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Seguridad y cumplimiento" icon={ShieldCheck}>
        <div className="space-y-2 text-sm text-stone-600">
          {CUMPLIMIENTO.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600" /> {item}
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-400 mt-3">
          Marco de cumplimiento a implementar en el backend antes del lanzamiento comercial.
        </p>
      </SectionCard>
    </div>
  );
}
