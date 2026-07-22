'use client';

import { ChefHat, Loader2, Share2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import type { Paciente, RecetaEnCurso, RecetaSugerida } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useGenerarJSON, useGenerarTexto } from '@/hooks/useIA';
import { useAppState } from '@/store/app-state';

type RecetaGenerada = Omit<RecetaSugerida, 'id' | 'enviada'>;

export function TabRecetas({ paciente }: { paciente: Paciente }) {
  const { updatePatient } = useAppState();
  const [ajusteAbierto, setAjusteAbierto] = useState<number | null>(null);
  const [ajusteTexto, setAjusteTexto] = useState('');
  const [ajusteResultado, setAjusteResultado] = useState<Record<number, string>>({});
  const [ideaNueva, setIdeaNueva] = useState('');
  const ajustar = useGenerarTexto();
  const generarReceta = useGenerarJSON<RecetaGenerada>();
  const s = paciente.seguimiento;

  const sugerirCambio = (receta: RecetaEnCurso) => {
    const prompt = `Eres un asistente para nutriólogos. El paciente prepara: "${receta.nombre}". Ajústala así: "${ajusteTexto}". Considera alergias (${paciente.preferencias.alergias.join(', ')}) y objetivo (${paciente.medico.objetivo}). Da una versión ajustada en 3-4 líneas, lista para enviar.`;
    ajustar.mutate(
      { prompt, maxTokens: 400 },
      {
        onSuccess: (respuesta) =>
          setAjusteResultado((r) => ({ ...r, [receta.id]: respuesta.trim() })),
      },
    );
  };

  const generarNueva = () => {
    const prompt = `Eres un asistente para nutriólogos. Sugiere una receta nueva${ideaNueva ? `, idea: "${ideaNueva}"` : ''}. Paciente: dieta ${paciente.preferencias.tipoDieta}, alergias ${paciente.preferencias.alergias.join(', ')}, no le gusta ${paciente.preferencias.disgustos || 'nada'}, objetivo ${paciente.medico.objetivo}. Responde SOLO JSON: {"nombre": string, "ingredientes": [string], "pasos_breve": string, "calorias": number, "porciones": number}`;
    generarReceta.mutate(
      { prompt, maxTokens: 500 },
      {
        onSuccess: (receta) => {
          updatePatient(paciente.id, (p) => ({
            seguimiento: {
              ...p.seguimiento,
              recetasSugeridas: [
                { id: Date.now(), enviada: false, ...receta },
                ...p.seguimiento.recetasSugeridas,
              ],
            },
          }));
          setIdeaNueva('');
        },
      },
    );
  };

  const enviarReceta = (id: number) =>
    updatePatient(paciente.id, (p) => ({
      seguimiento: {
        ...p.seguimiento,
        recetasSugeridas: p.seguimiento.recetasSugeridas.map((r) =>
          r.id === id ? { ...r, enviada: true } : r,
        ),
      },
    }));

  return (
    <div className="space-y-4">
      <SectionCard title="Recetas que está preparando el paciente" icon={ChefHat}>
        {s.recetasEnCurso.length === 0 && (
          <div className="text-sm text-stone-400">Aún no hay recetas registradas por el paciente.</div>
        )}
        <div className="space-y-3">
          {s.recetasEnCurso.map((r) => (
            <div key={r.id} className="border-t border-stone-100 pt-3 first:border-0 first:pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-emerald-950 font-medium">{r.nombre}</div>
                  <div className="text-xs text-stone-400">{r.frecuencia}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAjusteAbierto(ajusteAbierto === r.id ? null : r.id);
                    setAjusteTexto('');
                  }}
                  className="text-xs text-emerald-900 underline"
                >
                  Sugerir cambio
                </button>
              </div>
              {ajusteAbierto === r.id && (
                <div className="mt-2 bg-stone-50 rounded-lg p-3">
                  <textarea
                    value={ajusteTexto}
                    onChange={(e) => setAjusteTexto(e.target.value)}
                    placeholder="Ej. reducir carbohidratos, sustituir el queso..."
                    className="w-full text-xs border border-stone-200 rounded-lg p-2 resize-none focus:outline-none focus:border-emerald-400"
                    rows={2}
                  />
                  <Btn size="sm" onClick={() => sugerirCambio(r)} disabled={ajustar.isPending} className="mt-2">
                    {ajustar.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    Sugerir con IA
                  </Btn>
                  {ajustar.isError && (
                    <div className="text-orange-600 text-xs mt-2">{ajustar.error.message}</div>
                  )}
                  {ajusteResultado[r.id] && (
                    <div className="mt-2 text-xs text-emerald-900 bg-lime-50 border border-lime-200 rounded-lg p-2">
                      {ajusteResultado[r.id]}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Sugerir una receta nueva" icon={Sparkles}>
        <input
          value={ideaNueva}
          onChange={(e) => setIdeaNueva(e.target.value)}
          placeholder="Idea opcional, ej. 'algo con pollo y quinoa'"
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
        />
        <Btn size="sm" onClick={generarNueva} disabled={generarReceta.isPending} className="mt-2">
          {generarReceta.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Generar receta con IA
        </Btn>
        {generarReceta.isError && (
          <div className="text-orange-600 text-xs mt-2">
            {generarReceta.error instanceof SyntaxError
              ? 'La IA devolvió un formato inesperado. Intenta de nuevo.'
              : generarReceta.error.message}
          </div>
        )}
        <div className="space-y-3 mt-4">
          {s.recetasSugeridas.map((r) => (
            <div key={r.id} className="border-t border-stone-100 pt-3">
              <div className="text-sm text-emerald-950 font-medium">{r.nombre}</div>
              <div className="text-xs text-stone-500 mt-1">{r.ingredientes.join(', ')}</div>
              <div className="text-xs text-stone-500 mt-1">{r.pasos_breve}</div>
              <div className="font-mono text-xs text-stone-400 mt-1">
                {r.calorias} kcal · {r.porciones} porciones
              </div>
              <button
                type="button"
                onClick={() => enviarReceta(r.id)}
                disabled={r.enviada}
                className="flex items-center gap-1 text-xs text-emerald-900 underline mt-1 disabled:text-stone-400 disabled:no-underline"
              >
                <Share2 size={11} /> {r.enviada ? 'Enviada al paciente' : 'Enviar al paciente'}
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
