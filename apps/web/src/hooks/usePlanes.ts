'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { AlimentoFicha, Paciente, PlanAlimenticio } from '@nutria/shared';

import {
  alimentoAItem,
  crearPlanVacio,
  planAEditable,
  planAPayload,
  planIaAEditable,
  type PlanEditable,
} from '@/components/planes/editor-model';
import {
  activarPlan,
  actualizarPlan,
  actualizarPlantilla,
  archivarPlan,
  compartirPlan,
  crearPlan,
  crearPlantilla,
  duplicarPlan,
  eliminarPlantilla,
  listarPlanesPaciente,
  listarPlantillas,
  type GuardarPlanPayload,
  type GuardarPlantillaPayload,
  type PlanApi,
  type PlantillaPlanApi,
} from '@/services/planes';
import { MAX_ITEMS_POR_COMIDA } from '@/domain/planLimits';

export const CLAVE_PLANES = ['planes'] as const;
export const CLAVE_PLANTILLAS_PLAN = ['plantillas-plan'] as const;

function clavePlanesPaciente(pacienteId: string) {
  return [...CLAVE_PLANES, 'paciente', pacienteId] as const;
}

export function usePlanesPaciente(pacienteId: string) {
  const consulta = useQuery({
    queryKey: clavePlanesPaciente(pacienteId),
    queryFn: () => listarPlanesPaciente(pacienteId),
    enabled: Boolean(pacienteId),
    retry: false,
  });

  return {
    planes: consulta.data?.data ?? [],
    cargando: consulta.isPending,
    error: consulta.error,
  };
}

export function useCrearPlan(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: GuardarPlanPayload) => crearPlan(pacienteId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavePlanesPaciente(pacienteId) });
    },
  });
}

export function useActualizarPlan(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: GuardarPlanPayload }) =>
      actualizarPlan(id, cambios),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavePlanesPaciente(pacienteId) });
    },
  });
}

export function useCompartirPlan(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => compartirPlan(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavePlanesPaciente(pacienteId) });
    },
  });
}

export function useActivarPlan(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activarPlan(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavePlanesPaciente(pacienteId) });
    },
  });
}

export function useDuplicarPlan(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => duplicarPlan(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavePlanesPaciente(pacienteId) });
    },
  });
}

export function useArchivarPlan(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => archivarPlan(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavePlanesPaciente(pacienteId) });
    },
  });
}

export function usePlantillasPlanes() {
  const consulta = useQuery({
    queryKey: CLAVE_PLANTILLAS_PLAN,
    queryFn: () => listarPlantillas(),
    retry: false,
  });

  return {
    plantillas: consulta.data?.data ?? [],
    cargando: consulta.isPending,
    error: consulta.error,
  };
}

export function useCrearPlantilla() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: GuardarPlantillaPayload) => crearPlantilla(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_PLANTILLAS_PLAN });
    },
  });
}

export function useActualizarPlantilla() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      cambios,
    }: {
      id: string;
      cambios: Partial<GuardarPlantillaPayload>;
    }) => actualizarPlantilla(id, cambios),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_PLANTILLAS_PLAN });
    },
  });
}

export function useEliminarPlantilla() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => eliminarPlantilla(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_PLANTILLAS_PLAN });
    },
  });
}

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : 'No pudimos completar la acción.';
}

export function resolverIdParaActivar(
  requiereGuardado: boolean,
  guardado: Pick<PlanApi, 'id'> | null,
  planId: string | null | undefined,
): string | null {
  if (requiereGuardado) return guardado?.id ?? null;
  return planId ?? null;
}

/**
 * Orquesta el borrador visible y las transiciones persistentes del plan.
 *
 * Mantiene separado el estado editable de la caché: React Query conserva la
 * fuente remota y aquí solo vive el trabajo aún no guardado del formulario.
 */
export function usePlanWorkspace(paciente: Paciente) {
  const consultaPlanes = usePlanesPaciente(paciente.id);
  const crear = useCrearPlan(paciente.id);
  const actualizar = useActualizarPlan(paciente.id);
  const activar = useActivarPlan(paciente.id);
  const compartir = useCompartirPlan(paciente.id);
  const duplicar = useDuplicarPlan(paciente.id);

  const [plan, setPlan] = useState<PlanEditable | null>(null);
  const [baseGuardada, setBaseGuardada] = useState<PlanEditable | null>(null);
  const [modificado, setModificado] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  useEffect(() => {
    setPlan(null);
    setBaseGuardada(null);
    setModificado(false);
  }, [paciente.id]);

  useEffect(() => {
    if (plan || consultaPlanes.planes.length === 0) return;
    const inicial =
      consultaPlanes.planes.find((opcion) => opcion.estado === 'BORRADOR') ??
      consultaPlanes.planes.find((opcion) => opcion.estado === 'ACTIVO') ??
      consultaPlanes.planes[0];
    if (!inicial) return;
    const editable = planAEditable(inicial);
    setPlan(editable);
    setBaseGuardada(editable);
  }, [consultaPlanes.planes, plan]);

  const adoptarGuardado = (guardado: PlanApi) => {
    const editable = planAEditable(guardado);
    setPlan(editable);
    setBaseGuardada(editable);
    setModificado(false);
    setErrorAccion(null);
    return guardado;
  };

  const cambiarPlan = (actualizarPlan: (actual: PlanEditable) => PlanEditable) => {
    setPlan((actual) => (actual ? actualizarPlan(actual) : actual));
    setModificado(true);
    setErrorAccion(null);
  };

  const seleccionar = (id: string) => {
    if (modificado && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')) return;
    const seleccionado = consultaPlanes.planes.find((opcion) => opcion.id === id);
    if (!seleccionado) return;
    adoptarGuardado(seleccionado);
    setErrorAccion(null);
  };

  const nuevo = () => {
    if (modificado && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')) return;
    setPlan(crearPlanVacio(paciente.calculo, paciente.preferencias.comidasPorDia));
    setBaseGuardada(null);
    setModificado(true);
    setErrorAccion(null);
  };

  const guardar = async (): Promise<PlanApi | null> => {
    if (!plan) return null;
    setErrorAccion(null);
    try {
      const guardado = plan.id
        ? await actualizar.mutateAsync({ id: plan.id, cambios: planAPayload(plan) })
        : await crear.mutateAsync(planAPayload(plan));
      return adoptarGuardado(guardado);
    } catch (error) {
      setErrorAccion(mensajeError(error));
      return null;
    }
  };

  const activarActual = async () => {
    const requiereGuardado = modificado || !plan?.id;
    const guardado = requiereGuardado ? await guardar() : null;
    const id = resolverIdParaActivar(requiereGuardado, guardado, plan?.id);
    if (!id) return;
    try {
      adoptarGuardado(await activar.mutateAsync(id));
    } catch (error) {
      setErrorAccion(mensajeError(error));
    }
  };

  const compartirActual = async () => {
    if (!plan?.id || plan.estado !== 'ACTIVO') return;
    try {
      adoptarGuardado(await compartir.mutateAsync(plan.id));
    } catch (error) {
      setErrorAccion(mensajeError(error));
    }
  };

  const duplicarActual = async () => {
    if (!plan?.id) return;
    try {
      adoptarGuardado(await duplicar.mutateAsync(plan.id));
    } catch (error) {
      setErrorAccion(mensajeError(error));
    }
  };

  const aplicarPlantilla = async (plantilla: PlantillaPlanApi): Promise<boolean> => {
    if (
      modificado &&
      !window.confirm('La plantilla reemplazará los cambios sin guardar. ¿Continuar?')
    ) {
      return false;
    }
    try {
      adoptarGuardado(await crear.mutateAsync({ plantilla_id: plantilla.id }));
      return true;
    } catch (error) {
      setErrorAccion(mensajeError(error));
      return false;
    }
  };

  const agregarAlimento = (comidaClave: string, alimento: AlimentoFicha) =>
    cambiarPlan((actual) => ({
      ...actual,
      comidas: actual.comidas.map((comida) =>
        comida.clave === comidaClave
          ? {
              ...comida,
              items:
                comida.items.length >= MAX_ITEMS_POR_COMIDA
                  ? comida.items
                  : [...comida.items, alimentoAItem(alimento)],
            }
          : comida,
      ),
    }));

  const usarBorradorIa = (sugerencia: PlanAlimenticio) => {
    if (
      modificado &&
      !window.confirm('La propuesta reemplazará los cambios sin guardar. ¿Continuar?')
    ) {
      return;
    }
    setPlan(planIaAEditable(sugerencia));
    setBaseGuardada(null);
    setModificado(true);
    setErrorAccion(null);
  };

  const restablecer = () => {
    setPlan(baseGuardada);
    setModificado(false);
    setErrorAccion(null);
  };

  return {
    ...consultaPlanes,
    plan,
    modificado,
    errorAccion,
    enCurso:
      crear.isPending ||
      actualizar.isPending ||
      activar.isPending ||
      compartir.isPending ||
      duplicar.isPending,
    aplicandoPlantilla: crear.isPending,
    cambiarPlan,
    seleccionar,
    nuevo,
    guardar,
    activarActual,
    compartirActual,
    duplicarActual,
    aplicarPlantilla,
    agregarAlimento,
    usarBorradorIa,
    restablecer,
  };
}
