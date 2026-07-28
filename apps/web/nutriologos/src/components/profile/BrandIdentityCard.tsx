'use client';

import { Camera, ImageOff, Palette } from 'lucide-react';
import { useState } from 'react';

import { colors } from '@nutria/ui-tokens';

import type { FormularioMarca } from '@/components/profile/model';
import { SectionCard } from '@/components/ui/SectionCard';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';
import { MAX_BRAND_LOGO_BYTES } from '@/config/brandLogo';

type BrandIdentityCardProps = {
  form: FormularioMarca;
  onChange: (patch: Partial<FormularioMarca>) => void;
};

export function BrandIdentityCard({ form, onChange }: BrandIdentityCardProps) {
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

  const handleLogo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    if (!['image/png', 'image/jpeg'].includes(archivo.type)) {
      setErrorLogo('Usa una imagen PNG o JPG.');
      return;
    }
    if (archivo.size > MAX_BRAND_LOGO_BYTES) {
      setErrorLogo('El logo no puede superar 512 KB.');
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      onChange({ marcaLogo: typeof lector.result === 'string' ? lector.result : null });
      setErrorLogo(null);
    };
    lector.readAsDataURL(archivo);
  };

  return (
    <SectionCard title="Identidad visual" icon={Palette}>
      <div className="grid gap-6 sm:grid-cols-[150px_1fr]">
        <div>
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] border border-stone-200 bg-stone-50 shadow-sm">
            {form.marcaLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL local
              <img
                src={form.marcaLogo}
                alt="Logo de la marca"
                className="h-full w-full object-contain p-3"
              />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center font-display text-4xl text-white"
                style={{ backgroundColor: form.marcaColor }}
              >
                {(form.marcaNombre || form.nombreCompleto || 'N')[0]}
              </span>
            )}
          </div>
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-800 px-3 py-2 text-xs text-emerald-800 hover:bg-emerald-50">
            <Camera size={14} /> Cambiar logo
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleLogo}
            />
          </label>
          {form.marcaLogo && (
            <button
              type="button"
              className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-stone-400 hover:text-orange-600"
              onClick={() => onChange({ marcaLogo: null })}
            >
              <ImageOff size={13} /> Quitar logo
            </button>
          )}
          {errorLogo && <p className="mt-2 text-xs text-orange-600">{errorLogo}</p>}
        </div>

        <div className="space-y-3">
          <div>
            <label className={lbl} htmlFor="marca-nombre">
              Nombre del consultorio / marca
            </label>
            <input
              id="marca-nombre"
              className={inp}
              value={form.marcaNombre}
              onChange={(event) => onChange({ marcaNombre: event.target.value })}
              placeholder="Ej. Balance Vital"
            />
          </div>
          <div>
            <span className={lbl}>Color de marca</span>
            <div className="flex flex-wrap gap-2" aria-label="Color de marca">
              {colors.brandPalette.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => onChange({ marcaColor: color })}
                  className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${
                    form.marcaColor === color ? 'ring-2 ring-stone-500 ring-offset-2' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Usar color ${color}`}
                  aria-pressed={form.marcaColor === color}
                />
              ))}
            </div>
          </div>
          <div
            className="rounded-xl border-l-4 bg-stone-50 p-4"
            style={{ borderColor: form.marcaColor }}
          >
            <p className="font-display text-lg text-emerald-950">
              {form.marcaNombre || 'Tu consultorio'}
            </p>
            <p className="text-xs text-stone-500">
              {form.nombreCompleto || 'Tu nombre profesional'} · Plan alimenticio personalizado
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
