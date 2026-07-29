'use client';

import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Btn } from '@/components/ui/Btn';
import { inputClass, labelClass } from '@/components/ui/campos';

import { useRegistrarFoto } from '../useRegistro';
import { ErrorFormulario } from './error';

export function FormFoto({ onAtras, onHecho }: { onAtras: () => void; onHecho: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const guardar = useRegistrarFoto();

  useEffect(() => {
    if (!archivo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!archivo) return;
    try {
      await guardar.mutateAsync({ archivo, descripcion: descripcion.trim() });
      onHecho();
    } catch {
      // Se conserva la foto y la descripción para que el paciente reintente.
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      <button type="button" onClick={onAtras} className="text-xs text-stone-500">
        ← Volver a opciones
      </button>

      <label className="block cursor-pointer">
        <span className={labelClass}>Foto del plato</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          required
          className="sr-only"
          onChange={(evento) => setArchivo(evento.target.files?.[0] ?? null)}
        />
        {preview ? (
          <span
            role="img"
            aria-label="Vista previa de la comida"
            className="block aspect-[4/3] rounded-2xl bg-cover bg-center shadow-inner ring-1 ring-stone-200"
            style={{ backgroundImage: `url("${preview}")` }}
          />
        ) : (
          <span className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50 text-amber-800">
            <Camera size={28} aria-hidden />
            <span className="mt-2 text-sm font-medium">Abrir cámara o galería</span>
            <span className="mt-0.5 text-[11px] text-amber-700">JPG, PNG o WebP · hasta 5 MB</span>
          </span>
        )}
      </label>

      <div>
        <label htmlFor="descripcion-foto" className={labelClass}>
          ¿Qué aparece en la foto?
        </label>
        <input
          id="descripcion-foto"
          value={descripcion}
          onChange={(evento) => setDescripcion(evento.target.value)}
          minLength={1}
          maxLength={200}
          required
          placeholder="Ej. ensalada con pollo"
          className={inputClass}
        />
      </div>

      <p className="text-[11px] leading-relaxed text-stone-500">
        Guardaremos la foto con tu registro. No estimamos nutrientes a partir de la imagen.
      </p>
      <ErrorFormulario error={guardar.error} />
      <Btn
        type="submit"
        disabled={guardar.isPending || !archivo || !descripcion.trim()}
        className="w-full"
      >
        {guardar.isPending ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : (
          <ImagePlus size={16} aria-hidden />
        )}
        {guardar.isPending ? 'Guardando…' : 'Guardar foto'}
      </Btn>
    </form>
  );
}
