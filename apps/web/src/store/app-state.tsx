'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Cita, Factura, Marca, MensajeChat, PlantillaPlan } from '@nutria/shared';

import { EXTRAS_VACIOS, type ExtrasPaciente } from '@/services/pacientes';

import { CITAS_DEMO, FACTURAS_DEMO, MARCA_DEMO, MENSAJES_DEMO, PLANTILLAS_DEMO } from './datos-demo';

/**
 * Almacén puente.
 *
 * Los pacientes y su expediente ya viven en PostgreSQL (ver `usePacientes`).
 * Aquí solo quedan las partes que sus fases todavía no migran: el cálculo, el
 * plan, el seguimiento, las recetas y las notas de cada paciente, más agenda,
 * mensajes, facturación, plantillas y marca. Cada fase irá vaciando este archivo.
 */

const STORAGE_KEY = 'nutria-web-state-v2';

type ExtrasPorPaciente = Record<string, ExtrasPaciente>;

type PersistedState = {
  extras: ExtrasPorPaciente;
  citas: Cita[];
  mensajes: Record<string, MensajeChat[]>;
  facturas: Factura[];
  plantillas: PlantillaPlan[];
  marca: Marca;
};

export type ExtrasPatch =
  | Partial<ExtrasPaciente>
  | ((actual: ExtrasPaciente) => Partial<ExtrasPaciente>);

type AppState = PersistedState & {
  hydrated: boolean;
  updatePatient: (id: string, patch: ExtrasPatch) => void;
  setCitas: React.Dispatch<React.SetStateAction<Cita[]>>;
  setMensajes: React.Dispatch<React.SetStateAction<Record<string, MensajeChat[]>>>;
  setFacturas: React.Dispatch<React.SetStateAction<Factura[]>>;
  setPlantillas: React.Dispatch<React.SetStateAction<PlantillaPlan[]>>;
  setMarca: React.Dispatch<React.SetStateAction<Marca>>;
};

const AppStateContext = createContext<AppState | null>(null);

function leerEstadoGuardado(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    // Estado corrupto: se descarta y se arranca en blanco.
    return null;
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [extras, setExtras] = useState<ExtrasPorPaciente>({});
  const [citas, setCitas] = useState<Cita[]>(CITAS_DEMO);
  const [mensajes, setMensajes] = useState<Record<string, MensajeChat[]>>(MENSAJES_DEMO);
  const [facturas, setFacturas] = useState<Factura[]>(FACTURAS_DEMO);
  const [plantillas, setPlantillas] = useState<PlantillaPlan[]>(PLANTILLAS_DEMO);
  const [marca, setMarca] = useState<Marca>(MARCA_DEMO);

  useEffect(() => {
    const guardado = leerEstadoGuardado();
    if (guardado) {
      setExtras(guardado.extras ?? {});
      setCitas(guardado.citas);
      setMensajes(guardado.mensajes);
      setFacturas(guardado.facturas);
      setPlantillas(guardado.plantillas);
      setMarca(guardado.marca);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const estado: PersistedState = { extras, citas, mensajes, facturas, plantillas, marca };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch {
      // Sin espacio o storage bloqueado: la app sigue funcionando en memoria.
    }
  }, [hydrated, extras, citas, mensajes, facturas, plantillas, marca]);

  const updatePatient = useCallback((id: string, patch: ExtrasPatch) => {
    setExtras((previos) => {
      const actual = previos[id] ?? EXTRAS_VACIOS;
      const cambios = typeof patch === 'function' ? patch(actual) : patch;
      return { ...previos, [id]: { ...actual, ...cambios } };
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      hydrated,
      extras,
      citas,
      mensajes,
      facturas,
      plantillas,
      marca,
      updatePatient,
      setCitas,
      setMensajes,
      setFacturas,
      setPlantillas,
      setMarca,
    }),
    [hydrated, extras, citas, mensajes, facturas, plantillas, marca, updatePatient],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState debe usarse dentro de AppStateProvider');
  return ctx;
}

/** Extras de un paciente, con valores vacíos si todavía no tiene ninguno. */
export function useExtrasPaciente(id: string): ExtrasPaciente {
  const { extras } = useAppState();
  return extras[id] ?? EXTRAS_VACIOS;
}
