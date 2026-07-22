'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Cita, Factura, Marca, MensajeChat, Paciente, PlantillaPlan } from '@nutria/shared';

import {
  CITAS_DEMO,
  FACTURAS_DEMO,
  MARCA_DEMO,
  MENSAJES_DEMO,
  PACIENTES_DEMO,
  PLANTILLAS_DEMO,
} from './datos-demo';

const STORAGE_KEY = 'nutria-web-state-v1';

type PersistedState = {
  pacientes: Paciente[];
  citas: Cita[];
  mensajes: Record<number, MensajeChat[]>;
  facturas: Factura[];
  plantillas: PlantillaPlan[];
  marca: Marca;
};

export type PatientPatch = Partial<Paciente> | ((p: Paciente) => Partial<Paciente>);

type AppState = PersistedState & {
  hydrated: boolean;
  crearPaciente: (p: Paciente) => void;
  updatePatient: (id: number, patch: PatientPatch) => void;
  setCitas: React.Dispatch<React.SetStateAction<Cita[]>>;
  setMensajes: React.Dispatch<React.SetStateAction<Record<number, MensajeChat[]>>>;
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
    // Estado corrupto: se descarta y se arranca con datos demo.
    return null;
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [pacientes, setPacientes] = useState<Paciente[]>(PACIENTES_DEMO);
  const [citas, setCitas] = useState<Cita[]>(CITAS_DEMO);
  const [mensajes, setMensajes] = useState<Record<number, MensajeChat[]>>(MENSAJES_DEMO);
  const [facturas, setFacturas] = useState<Factura[]>(FACTURAS_DEMO);
  const [plantillas, setPlantillas] = useState<PlantillaPlan[]>(PLANTILLAS_DEMO);
  const [marca, setMarca] = useState<Marca>(MARCA_DEMO);

  useEffect(() => {
    const guardado = leerEstadoGuardado();
    if (guardado) {
      setPacientes(guardado.pacientes);
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
    const estado: PersistedState = { pacientes, citas, mensajes, facturas, plantillas, marca };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch {
      // Sin espacio o storage bloqueado: la app sigue funcionando en memoria.
    }
  }, [hydrated, pacientes, citas, mensajes, facturas, plantillas, marca]);

  const updatePatient = useCallback((id: number, patch: PatientPatch) => {
    setPacientes((ps) =>
      ps.map((p) => (p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)),
    );
  }, []);

  const crearPaciente = useCallback((p: Paciente) => {
    setPacientes((ps) => [p, ...ps]);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      hydrated,
      pacientes,
      citas,
      mensajes,
      facturas,
      plantillas,
      marca,
      crearPaciente,
      updatePatient,
      setCitas,
      setMensajes,
      setFacturas,
      setPlantillas,
      setMarca,
    }),
    [hydrated, pacientes, citas, mensajes, facturas, plantillas, marca, crearPaciente, updatePatient],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState debe usarse dentro de AppStateProvider');
  return ctx;
}
