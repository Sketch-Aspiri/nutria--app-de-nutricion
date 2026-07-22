'use client';

import { AlertTriangle, Download, Share2 } from 'lucide-react';

import { tieneConflictoAlergia, type Paciente, type PlanAlimenticio } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';

type PlanEditorProps = {
  paciente: Paciente;
  borrador: PlanAlimenticio;
  onChange: (fn: (b: PlanAlimenticio) => PlanAlimenticio) => void;
  onCompartir: () => void;
  onExportar: () => void;
  onDescartar: () => void;
};

/** Editor inline del borrador de plan: kcal, macros y comidas editables campo por campo. */
export function PlanEditor({ paciente, borrador, onChange, onCompartir, onExportar, onDescartar }: PlanEditorProps) {
  const editarComida = (i: number, campo: 'nombre' | 'horario' | 'descripcion' | 'porcion' | 'calorias', valor: string | number) =>
    onChange((b) => ({
      ...b,
      comidas: b.comidas.map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c)),
    }));
  const editarMacro = (campo: 'proteina_g' | 'carbos_g' | 'grasa_g', valor: number) =>
    onChange((b) => ({ ...b, macros: { ...b.macros, [campo]: valor } }));

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className="bg-lime-50 border border-lime-200 text-emerald-900 text-xs rounded-lg px-3 py-2 mb-4">
        {borrador.compartido
          ? `Compartido con el paciente el ${borrador.compartido}. Puedes seguir editando.`
          : 'Borrador editable — ajústalo antes de compartir.'}
      </div>
      <div className="flex items-center gap-6 mb-4">
        <div>
          <input
            type="number"
            value={borrador.calorias_diarias}
            onChange={(e) => onChange((b) => ({ ...b, calorias_diarias: Number(e.target.value) }))}
            className="font-mono text-2xl text-emerald-950 w-24 border-b border-stone-200 focus:outline-none focus:border-emerald-400"
          />
          <div className="text-xs text-stone-400">kcal / día</div>
        </div>
        <div className="flex gap-4 text-xs text-stone-500">
          {(
            [
              ['proteina_g', 'g proteína'],
              ['carbos_g', 'g carbos'],
              ['grasa_g', 'g grasa'],
            ] as const
          ).map(([campo, etiqueta]) => (
            <div key={campo}>
              <input
                type="number"
                value={borrador.macros[campo]}
                onChange={(e) => editarMacro(campo, Number(e.target.value))}
                className="font-mono w-12 text-emerald-900 border-b border-stone-200 focus:outline-none"
              />
              {etiqueta}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {borrador.comidas.map((c, i) => {
          const conflicto = tieneConflictoAlergia(c.descripcion, paciente.preferencias.alergias);
          return (
            <div key={i} className="border-t border-stone-100 pt-3 first:border-0 first:pt-0">
              <div className="flex items-center gap-2 mb-1">
                <input
                  value={c.nombre}
                  onChange={(e) => editarComida(i, 'nombre', e.target.value)}
                  className="text-sm text-emerald-950 font-medium border-b border-transparent hover:border-stone-200 focus:border-emerald-400 focus:outline-none"
                />
                <span className="text-stone-400">·</span>
                <input
                  value={c.horario}
                  onChange={(e) => editarComida(i, 'horario', e.target.value)}
                  className="text-xs text-stone-400 w-20 border-b border-transparent hover:border-stone-200 focus:border-emerald-400 focus:outline-none"
                />
                {conflicto && (
                  <span className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 ml-auto">
                    <AlertTriangle size={10} /> revisar alergia
                  </span>
                )}
              </div>
              <textarea
                value={c.descripcion}
                onChange={(e) => editarComida(i, 'descripcion', e.target.value)}
                className="w-full text-xs text-stone-600 resize-none border-b border-transparent hover:border-stone-200 focus:border-emerald-400 focus:outline-none"
                rows={2}
              />
              <div className="flex gap-4 mt-1 text-xs text-stone-400">
                <span>
                  Porción:{' '}
                  <input
                    value={c.porcion ?? ''}
                    onChange={(e) => editarComida(i, 'porcion', e.target.value)}
                    className="w-24 border-b border-transparent hover:border-stone-200 focus:border-emerald-400 focus:outline-none"
                  />
                </span>
                <span className="font-mono">
                  <input
                    type="number"
                    value={c.calorias}
                    onChange={(e) => editarComida(i, 'calorias', Number(e.target.value))}
                    className="w-14 border-b border-transparent hover:border-stone-200 focus:border-emerald-400 focus:outline-none"
                  />{' '}
                  kcal
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-5">
        <Btn size="sm" onClick={onCompartir}>
          <Share2 size={14} /> {borrador.compartido ? 'Volver a compartir' : 'Compartir con paciente'}
        </Btn>
        <Btn size="sm" variant="outline" onClick={onExportar}>
          <Download size={14} /> Exportar PDF con marca
        </Btn>
        <Btn size="sm" variant="ghost" onClick={onDescartar}>
          Descartar
        </Btn>
      </div>
    </div>
  );
}
