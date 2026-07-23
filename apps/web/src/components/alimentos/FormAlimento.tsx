'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  type AlimentoFicha,
  equivalentesSugeridos,
  type GrupoAlimento,
  GRUPOS_ALIMENTO,
  NOMBRE_GRUPO_ALIMENTO,
  verificarEnergia,
} from '@nutria/shared';

import { textoEquivalentes } from '@/components/alimentos/FichaAlimento';
import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { inputClass, labelClass } from '@/components/ui/campos';
import type { AlimentoPropioPayload } from '@/services/alimentos';

/**
 * Alta y edición de un alimento propio: una receta de casa, una marca local,
 * un platillo que el nutriólogo receta seguido y no está en el catálogo.
 *
 * Los micronutrimentos se dejan en blanco a propósito cuando no se conocen:
 * el campo vacío se guarda como "sin capturar", no como cero.
 */

type FormAlimentoProps = {
  inicial?: AlimentoFicha;
  guardando: boolean;
  error: string | null;
  onGuardar: (payload: AlimentoPropioPayload) => void;
  onClose: () => void;
};

type CamposTexto = Record<string, string>;

/** Campos numéricos opcionales, en el orden en que se capturan. */
const MICRONUTRIMENTOS: { clave: keyof AlimentoFicha; etiqueta: string }[] = [
  { clave: 'saturadas_g', etiqueta: 'Saturadas (g)' },
  { clave: 'colesterol_mg', etiqueta: 'Colesterol (mg)' },
  { clave: 'fibra_g', etiqueta: 'Fibra (g)' },
  { clave: 'azucar_g', etiqueta: 'Azúcares (g)' },
  { clave: 'sodio_mg', etiqueta: 'Sodio (mg)' },
  { clave: 'potasio_mg', etiqueta: 'Potasio (mg)' },
  { clave: 'calcio_mg', etiqueta: 'Calcio (mg)' },
  { clave: 'hierro_mg', etiqueta: 'Hierro (mg)' },
  { clave: 'acido_folico_ug', etiqueta: 'Folato (µg)' },
  { clave: 'vitamina_a_ug', etiqueta: 'Vitamina A (µg)' },
  { clave: 'vitamina_c_mg', etiqueta: 'Vitamina C (mg)' },
  { clave: 'indice_glicemico', etiqueta: 'Índice glicémico' },
];

function comoTexto(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '' : String(valor);
}

function estadoInicial(alimento?: AlimentoFicha): CamposTexto {
  const campos: CamposTexto = {
    nombre: alimento?.nombre ?? '',
    subgrupo: alimento?.subgrupo ?? '',
    porcion_descripcion: alimento?.porcion_descripcion ?? '',
    porcion_gramos: comoTexto(alimento?.porcion_gramos),
    energia_kcal: comoTexto(alimento?.energia_kcal),
    proteina_g: comoTexto(alimento?.proteina_g),
    lipidos_g: comoTexto(alimento?.lipidos_g),
    carbohidratos_g: comoTexto(alimento?.carbohidratos_g),
  };

  for (const { clave } of MICRONUTRIMENTOS) {
    campos[clave] = comoTexto(alimento?.[clave] as number | null | undefined);
  }

  return campos;
}

/** Vacío = sin capturar (`null`); con valor = número. */
function numeroOpcional(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === '') return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

function numero(texto: string): number {
  return numeroOpcional(texto) ?? 0;
}

export function FormAlimento({
  inicial,
  guardando,
  error,
  onGuardar,
  onClose,
}: FormAlimentoProps) {
  const [campos, setCampos] = useState<CamposTexto>(() => estadoInicial(inicial));
  const [grupo, setGrupo] = useState<GrupoAlimento>(inicial?.grupo ?? 'verduras');

  const escribir = (clave: string, valor: string) =>
    setCampos((previos) => ({ ...previos, [clave]: valor }));

  const kcal = numero(campos.energia_kcal ?? '');

  // Se recalculan en cada tecla: el nutriólogo ve el equivalente que va a
  // quedar guardado antes de guardarlo, no después.
  const equivalentes = useMemo(() => equivalentesSugeridos(grupo, kcal), [grupo, kcal]);

  const revision = useMemo(
    () =>
      verificarEnergia({
        energia_kcal: kcal,
        proteina_g: numero(campos.proteina_g ?? ''),
        lipidos_g: numero(campos.lipidos_g ?? ''),
        carbohidratos_g: numero(campos.carbohidratos_g ?? ''),
      }),
    [kcal, campos.proteina_g, campos.lipidos_g, campos.carbohidratos_g],
  );

  const listo =
    (campos.nombre ?? '').trim().length >= 2 &&
    (campos.porcion_descripcion ?? '').trim().length > 0 &&
    numero(campos.porcion_gramos ?? '') > 0;

  const enviar = () => {
    const opcionales = Object.fromEntries(
      MICRONUTRIMENTOS.map(({ clave }) => [clave, numeroOpcional(campos[clave] ?? '')]),
    );

    onGuardar({
      ...opcionales,
      nombre: (campos.nombre ?? '').trim(),
      grupo,
      subgrupo: (campos.subgrupo ?? '').trim() || null,
      porcion_descripcion: (campos.porcion_descripcion ?? '').trim(),
      porcion_gramos: numero(campos.porcion_gramos ?? ''),
      energia_kcal: kcal,
      proteina_g: numero(campos.proteina_g ?? ''),
      lipidos_g: numero(campos.lipidos_g ?? ''),
      carbohidratos_g: numero(campos.carbohidratos_g ?? ''),
      equivalentes,
      imagen_url: inicial?.imagen_url ?? null,
    } as AlimentoPropioPayload);
  };

  return (
    <Modal wide>
      <div className="p-6">
        <ModalHeader
          title={inicial ? 'Editar alimento' : 'Nuevo alimento propio'}
          onClose={onClose}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass} htmlFor="alimento-nombre">
              Nombre
            </label>
            <input
              id="alimento-nombre"
              value={campos.nombre}
              onChange={(evento) => escribir('nombre', evento.target.value)}
              className={inputClass}
              placeholder="Ej. Tamal de rajas de la receta de la abuela"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="alimento-grupo">
              Grupo de equivalentes
            </label>
            <select
              id="alimento-grupo"
              value={grupo}
              onChange={(evento) => setGrupo(evento.target.value as GrupoAlimento)}
              className={inputClass}
            >
              {GRUPOS_ALIMENTO.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {NOMBRE_GRUPO_ALIMENTO[opcion]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="alimento-subgrupo">
              Subgrupo (opcional)
            </label>
            <input
              id="alimento-subgrupo"
              value={campos.subgrupo}
              onChange={(evento) => escribir('subgrupo', evento.target.value)}
              className={inputClass}
              placeholder="Ej. con grasa"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="alimento-porcion">
              Porción
            </label>
            <input
              id="alimento-porcion"
              value={campos.porcion_descripcion}
              onChange={(evento) => escribir('porcion_descripcion', evento.target.value)}
              className={inputClass}
              placeholder="1 pieza"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="alimento-gramos">
              Gramos de la porción
            </label>
            <input
              id="alimento-gramos"
              type="number"
              value={campos.porcion_gramos}
              onChange={(evento) => escribir('porcion_gramos', evento.target.value)}
              className={inputClass}
            />
          </div>

          <CampoNumero
            id="alimento-kcal"
            etiqueta="Energía (kcal)"
            valor={campos.energia_kcal ?? ''}
            onChange={(valor) => escribir('energia_kcal', valor)}
          />
          <CampoNumero
            id="alimento-proteina"
            etiqueta="Proteína (g)"
            valor={campos.proteina_g ?? ''}
            onChange={(valor) => escribir('proteina_g', valor)}
          />
          <CampoNumero
            id="alimento-lipidos"
            etiqueta="Lípidos (g)"
            valor={campos.lipidos_g ?? ''}
            onChange={(valor) => escribir('lipidos_g', valor)}
          />
          <CampoNumero
            id="alimento-carbohidratos"
            etiqueta="Hidratos de carbono (g)"
            valor={campos.carbohidratos_g ?? ''}
            onChange={(valor) => escribir('carbohidratos_g', valor)}
          />
        </div>

        <div className="mt-4 text-xs text-stone-500 bg-white border border-stone-200 rounded-lg px-3 py-2">
          Equivalentes que se guardarán: <strong>{textoEquivalentes(equivalentes)}</strong>
        </div>

        {!revision.coherente && kcal > 0 && (
          <div className="mt-3 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {revision.motivo} Revisa que no se haya colado un dígito de más; se puede guardar
              así si el dato es correcto.
            </span>
          </div>
        )}

        <details className="mt-4">
          <summary className="text-xs text-stone-500 cursor-pointer">
            Micronutrimentos (opcionales)
          </summary>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {MICRONUTRIMENTOS.map(({ clave, etiqueta }) => (
              <CampoNumero
                key={clave}
                id={`alimento-${clave}`}
                etiqueta={etiqueta}
                valor={campos[clave] ?? ''}
                onChange={(valor) => escribir(clave, valor)}
              />
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-2">
            Lo que dejes en blanco queda como &quot;sin capturar&quot;, no como cero.
          </p>
        </details>

        {error && (
          <div className="mt-4 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="ghost" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn onClick={enviar} disabled={!listo || guardando}>
            {guardando && <Loader2 size={16} className="animate-spin" />}
            {inicial ? 'Guardar cambios' : 'Agregar alimento'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

type CampoNumeroProps = {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
};

function CampoNumero({ id, etiqueta, valor, onChange }: CampoNumeroProps) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        type="number"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        className={inputClass}
      />
    </div>
  );
}
