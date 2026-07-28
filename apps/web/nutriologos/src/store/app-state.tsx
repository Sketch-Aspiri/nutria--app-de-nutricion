'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Factura } from '@nutria/shared';

import { EXTRAS_VACIOS, type ExtrasPaciente } from '@/services/pacientes';

import { FACTURAS_DEMO } from './datos-demo';

/**
 * Almacén puente.
 *
 * Los pacientes, su expediente, su cálculo y sus planes ya viven en PostgreSQL.
 * Aquí solo quedan las recetas y las notas de consulta de cada paciente, más
 * la facturación, que migra en la fase 7.
 *
 * Planes, plantillas y marca salieron en la fase 4; la agenda, los mensajes,
 * el seguimiento y el plan de actividad, en la fase 6.
 */

const STORAGE_KEY = 'nutria-web-state-v2';

type ExtrasPorPaciente = Record<string, ExtrasPaciente>;

type PersistedState = {
  extras: ExtrasPorPaciente;
  facturas: Factura[];
};

export type ExtrasPatch =
  | Partial<ExtrasPaciente>
  | ((actual: ExtrasPaciente) => Partial<ExtrasPaciente>);

type AppState = PersistedState & {
  hydrated: boolean;
  updatePatient: (id: string, patch: ExtrasPatch) => void;
  setFacturas: React.Dispatch<React.SetStateAction<Factura[]>>;
};

const AppStateContext = createContext<AppState | null>(null);

function limpiarExtras(valor: unknown): ExtrasPorPaciente {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};

  return Object.fromEntries(
    Object.entries(valor).map(([id, extra]) => {
      const candidato =
        extra && typeof extra === 'object' ? (extra as Partial<ExtrasPaciente>) : {};
      return [
        id,
        {
          // Las notas clínicas viven cifradas en PostgreSQL. Se descartan
          // copias antiguas para no conservar datos de salud en localStorage.
          notasConsulta: [],
          seguimiento: candidato.seguimiento ?? EXTRAS_VACIOS.seguimiento,
        },
      ];
    }),
  );
}

function leerEstadoGuardado(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const guardado = JSON.parse(raw) as Partial<PersistedState>;
    return {
      extras: limpiarExtras(guardado.extras),
      facturas: Array.isArray(guardado.facturas) ? guardado.facturas : [],
    };
  } catch {
    // Estado corrupto: se descarta y se arranca en blanco.
    return null;
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [extras, setExtras] = useState<ExtrasPorPaciente>({});
  const [facturas, setFacturas] = useState<Factura[]>(FACTURAS_DEMO);

  useEffect(() => {
    const guardado = leerEstadoGuardado();
    if (guardado) {
      setExtras(guardado.extras ?? {});
      setFacturas(guardado.facturas);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const estado: PersistedState = { extras, facturas };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch {
      // Sin espacio o storage bloqueado: la app sigue funcionando en memoria.
    }
  }, [hydrated, extras, facturas]);

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
      facturas,
      updatePatient,
      setFacturas,
    }),
    [hydrated, extras, facturas, updatePatient],
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
