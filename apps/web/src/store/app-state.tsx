'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Cita, Factura, MensajeChat } from '@nutria/shared';

import { EXTRAS_VACIOS, type ExtrasPaciente } from '@/services/pacientes';

import { CITAS_DEMO, FACTURAS_DEMO, MENSAJES_DEMO } from './datos-demo';

/**
 * Almacén puente.
 *
 * Los pacientes, su expediente y su cálculo nutricional ya viven en PostgreSQL
 * (ver `usePacientes`). Aquí solo quedan las partes que sus fases todavía no
 * migran: seguimiento, recetas y notas de cada paciente, además de agenda,
 * mensajes y facturación. Planes, plantillas y marca salieron en la fase 4.
 */

const STORAGE_KEY = 'nutria-web-state-v2';

type ExtrasPorPaciente = Record<string, ExtrasPaciente>;

type PersistedState = {
  extras: ExtrasPorPaciente;
  citas: Cita[];
  mensajes: Record<string, MensajeChat[]>;
  facturas: Factura[];
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
          planEjercicio: candidato.planEjercicio ?? null,
          notasConsulta: Array.isArray(candidato.notasConsulta) ? candidato.notasConsulta : [],
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
      citas: Array.isArray(guardado.citas) ? guardado.citas : [],
      mensajes:
        guardado.mensajes && typeof guardado.mensajes === 'object'
          ? guardado.mensajes
          : {},
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
  const [citas, setCitas] = useState<Cita[]>(CITAS_DEMO);
  const [mensajes, setMensajes] = useState<Record<string, MensajeChat[]>>(MENSAJES_DEMO);
  const [facturas, setFacturas] = useState<Factura[]>(FACTURAS_DEMO);

  useEffect(() => {
    const guardado = leerEstadoGuardado();
    if (guardado) {
      setExtras(guardado.extras ?? {});
      setCitas(guardado.citas);
      setMensajes(guardado.mensajes);
      setFacturas(guardado.facturas);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const estado: PersistedState = { extras, citas, mensajes, facturas };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch {
      // Sin espacio o storage bloqueado: la app sigue funcionando en memoria.
    }
  }, [hydrated, extras, citas, mensajes, facturas]);

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
      updatePatient,
      setCitas,
      setMensajes,
      setFacturas,
    }),
    [hydrated, extras, citas, mensajes, facturas, updatePatient],
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
