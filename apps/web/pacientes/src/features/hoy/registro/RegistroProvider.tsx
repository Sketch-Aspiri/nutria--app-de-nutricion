'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useHoy } from '../useHoy';
import { RegistroSheet } from './RegistroSheet';

type RegistroContexto = {
  abrirRegistro: () => void;
};

const RegistroContext = createContext<RegistroContexto | null>(null);

export function RegistroProvider({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  // La fecha de peso y ejercicio siempre se confirma contra la zona horaria
  // clínica. `staleTime: 0` evita reutilizar el día de una hoja abierta antes
  // de medianoche.
  const hoy = useHoy(abierto, 0);

  useEffect(() => {
    if (!mensaje) return;
    const timeout = window.setTimeout(() => setMensaje(null), 3_500);
    return () => window.clearTimeout(timeout);
  }, [mensaje]);

  const abrirRegistro = useCallback(() => setAbierto(true), []);
  const valor = useMemo(() => ({ abrirRegistro }), [abrirRegistro]);
  const completar = (texto: string) => {
    setAbierto(false);
    setMensaje(texto);
  };

  return (
    <RegistroContext.Provider value={valor}>
      {children}
      {abierto && (
        <RegistroSheet
          // React Query conserva `data` si un refetch falla. Nunca se usa ese
          // valor potencialmente de ayer para fechar datos de salud.
          dia={hoy.isFetching || hoy.isError ? null : (hoy.data?.dia ?? null)}
          cargandoDia={hoy.isFetching}
          onClose={() => setAbierto(false)}
          onSuccess={completar}
        />
      )}
      {mensaje && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-emerald-950 px-4 py-2.5 text-center text-xs text-white shadow-xl"
        >
          {mensaje}
        </div>
      )}
    </RegistroContext.Provider>
  );
}

export function useAbrirRegistro(): () => void {
  const contexto = useContext(RegistroContext);
  if (!contexto) throw new Error('useAbrirRegistro requiere RegistroProvider.');
  return contexto.abrirRegistro;
}
