'use client';

import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BrandIdentityCard } from '@/components/profile/BrandIdentityCard';
import {
  FORMULARIO_MARCA_VACIO,
  type FormularioMarca,
} from '@/components/profile/model';
import { ProfessionalDataCard } from '@/components/profile/ProfessionalDataCard';
import { Btn } from '@/components/ui/Btn';
import { useActualizarPerfil, usePerfil } from '@/hooks/usePerfil';

export default function MarcaPage() {
  const perfil = usePerfil();
  const actualizar = useActualizarPerfil();
  const [form, setForm] = useState<FormularioMarca>(FORMULARIO_MARCA_VACIO);
  const [modificado, setModificado] = useState(false);

  useEffect(() => {
    if (!perfil.data) return;
    const datos = perfil.data.perfil;
    setForm({
      nombreCompleto: datos?.nombre_completo ?? perfil.data.nombre ?? '',
      cedula: datos?.cedula_profesional ?? '',
      especialidad: datos?.especialidad ?? '',
      telefono: datos?.telefono ?? '',
      marcaNombre: datos?.marca_nombre ?? '',
      marcaColor: datos?.marca_color ?? '#065f46',
      marcaLogo: datos?.marca_logo_url ?? null,
    });
    setModificado(false);
  }, [perfil.data]);

  const cambiar = (patch: Partial<FormularioMarca>) => {
    setForm((actual) => ({ ...actual, ...patch }));
    setModificado(true);
    actualizar.reset();
  };

  const guardar = () => {
    actualizar.mutate(
      {
        nombre_completo: form.nombreCompleto,
        cedula_profesional: form.cedula || null,
        especialidad: form.especialidad || null,
        telefono: form.telefono || null,
        marca_nombre: form.marcaNombre || null,
        marca_color: form.marcaColor,
        marca_logo_url: form.marcaLogo,
      },
      { onSuccess: () => setModificado(false) },
    );
  };

  if (perfil.isPending) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-stone-500">
        <Loader2 size={16} className="animate-spin" /> Cargando tu identidad…
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4 p-5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime-700">
            Identidad profesional
          </p>
          <h1 className="font-display text-3xl font-medium text-emerald-950">Marca y datos</h1>
          <div className="mt-1 text-sm text-stone-500">
            Esta identidad aparece en cada plan alimenticio que entregas.
          </div>
        </div>
        <Btn
          onClick={guardar}
          disabled={actualizar.isPending || !form.nombreCompleto.trim() || !modificado}
        >
          {actualizar.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : actualizar.isSuccess ? (
            <Check size={16} />
          ) : null}
          {actualizar.isPending
            ? 'Guardando…'
            : actualizar.isSuccess && !modificado
              ? 'Guardado'
              : 'Guardar cambios'}
        </Btn>
      </div>

      {perfil.isError && (
        <div
          role="alert"
          className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700"
        >
          No pudimos cargar tu perfil. Recarga la página para intentarlo de nuevo.
        </div>
      )}
      {actualizar.isError && (
        <div
          role="alert"
          className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700"
        >
          {actualizar.error.message}
        </div>
      )}

      <BrandIdentityCard form={form} onChange={cambiar} />
      <ProfessionalDataCard form={form} onChange={cambiar} />
    </div>
  );
}
