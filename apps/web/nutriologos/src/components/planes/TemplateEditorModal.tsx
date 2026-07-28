'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import type { AlimentoFicha, ObjetivoDb } from '@nutria/shared';

import {
  alimentoAItem,
  editablesAEstructura,
  estructuraAEditable,
  itemTieneContenido,
  normalizarOrden,
  nuevaComida,
  type ComidaPlanEditable,
} from '@/components/planes/editor-model';
import { TemplateEditorFields } from '@/components/planes/TemplateEditorFields';
import { TemplateMealsEditor } from '@/components/planes/TemplateMealsEditor';
import { FoodPicker } from '@/components/pacientes/FoodPicker';
import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { MAX_ITEMS_POR_COMIDA } from '@/domain/planLimits';
import type {
  GuardarPlantillaPayload,
  PlantillaPlanApi,
} from '@/services/planes';

type TemplateEditorModalProps = {
  plantilla?: PlantillaPlanApi;
  guardando: boolean;
  error: string | null;
  onSave: (payload: GuardarPlantillaPayload) => void;
  onClose: () => void;
};

export function TemplateEditorModal({
  plantilla,
  guardando,
  error,
  onSave,
  onClose,
}: TemplateEditorModalProps) {
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '');
  const [objetivo, setObjetivo] = useState<ObjetivoDb>(
    plantilla?.objetivo ?? 'MANTENIMIENTO',
  );
  const [calorias, setCalorias] = useState(plantilla?.calorias ?? 0);
  const [descripcion, setDescripcion] = useState(plantilla?.descripcion ?? '');
  const [comidas, setComidas] = useState<ComidaPlanEditable[]>(() => {
    const guardadas = plantilla?.estructura.comidas ?? [];
    return guardadas.length > 0 ? estructuraAEditable(guardadas) : [nuevaComida(0)];
  });
  const [comidaParaAlimento, setComidaParaAlimento] = useState<string | null>(null);

  const cambiarComida = (clave: string, siguiente: ComidaPlanEditable) =>
    setComidas((actuales) =>
      actuales.map((comida) => (comida.clave === clave ? siguiente : comida)),
    );

  const moverComida = (indice: number, direccion: -1 | 1) =>
    setComidas((actuales) => {
      const destino = indice + direccion;
      const origen = actuales[indice];
      const receptora = actuales[destino];
      if (!origen || !receptora) return actuales;
      const siguientes = [...actuales];
      siguientes[indice] = receptora;
      siguientes[destino] = origen;
      return normalizarOrden(siguientes);
    });

  const agregarAlimento = (alimento: AlimentoFicha) => {
    if (!comidaParaAlimento) return;
    setComidas((actuales) =>
      actuales.map((comida) =>
        comida.clave === comidaParaAlimento
          ? {
              ...comida,
              items:
                comida.items.length >= MAX_ITEMS_POR_COMIDA
                  ? comida.items
                  : [...comida.items, alimentoAItem(alimento)],
            }
          : comida,
      ),
    );
    setComidaParaAlimento(null);
  };

  const tieneItems = comidas.some((comida) =>
    comida.items.some(itemTieneContenido),
  );

  return (
    <>
      <Modal wide>
        <form
          className="p-6"
          onSubmit={(evento) => {
            evento.preventDefault();
            onSave({
              nombre: nombre.trim(),
              objetivo,
              calorias,
              descripcion: descripcion.trim() || null,
              estructura: { comidas: editablesAEstructura(comidas) },
            });
          }}
        >
          <ModalHeader
            title={plantilla ? 'Editar plantilla' : 'Nueva plantilla'}
            onClose={onClose}
          />

          <TemplateEditorFields
            nombre={nombre}
            objetivo={objetivo}
            calorias={calorias}
            descripcion={descripcion}
            onNombreChange={setNombre}
            onObjetivoChange={setObjetivo}
            onCaloriasChange={setCalorias}
            onDescripcionChange={setDescripcion}
          />

          <TemplateMealsEditor
            comidas={comidas}
            onAddMeal={() =>
              setComidas((actuales) => [
                ...actuales,
                nuevaComida(actuales.length),
              ])
            }
            onChangeMeal={cambiarComida}
            onAddFood={setComidaParaAlimento}
            onMoveMeal={moverComida}
            onRemoveMeal={(clave) =>
              setComidas((actuales) =>
                normalizarOrden(
                  actuales.filter((actual) => actual.clave !== clave),
                ),
              )
            }
          />

          {!tieneItems && (
            <p className="mt-3 text-xs text-amber-700">
              Agrega al menos un alimento o item libre para guardar una
              plantilla útil.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-xs text-orange-600">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2 border-t border-stone-200 pt-4">
            <Btn variant="ghost" onClick={onClose} disabled={guardando}>
              Cancelar
            </Btn>
            <Btn
              type="submit"
              disabled={guardando || !nombre.trim() || calorias <= 0 || !tieneItems}
            >
              {guardando && <Loader2 size={14} className="animate-spin" />}
              Guardar plantilla
            </Btn>
          </div>
        </form>
      </Modal>
      {comidaParaAlimento && (
        <FoodPicker
          onAdd={agregarAlimento}
          onClose={() => setComidaParaAlimento(null)}
        />
      )}
    </>
  );
}
