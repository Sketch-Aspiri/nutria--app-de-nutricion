'use client';

import { useState } from 'react';

import { Btn } from '@/components/ui/Btn';
import { inputClass as inp } from '@/components/ui/campos';

type AgregarOtroProps = {
  id: string;
  placeholder: string;
  maxLength: number;
  /** Valores ya capturados: se usan para no aceptar duplicados. */
  existentes: string[];
  /** En false el campo se bloquea, p. ej. al llegar al máximo permitido. */
  habilitado?: boolean;
  onAgregar: (valor: string) => void;
};

/**
 * Campo para sumar un valor fuera del catálogo (una condición, una alergia, un
 * tipo de dieta). El texto en curso vive aquí porque no forma parte del
 * expediente hasta que se confirma.
 */
export function AgregarOtro({
  id,
  placeholder,
  maxLength,
  existentes,
  habilitado = true,
  onAgregar,
}: AgregarOtroProps) {
  const [texto, setTexto] = useState('');

  const limpio = texto.trim();
  const puedeAgregar =
    habilitado &&
    limpio.length > 0 &&
    // Comparación sin distinguir mayúsculas: "Gastritis" y "gastritis" son lo mismo.
    !existentes.some((valor) => valor.toLowerCase() === limpio.toLowerCase());

  const agregar = () => {
    if (!puedeAgregar) return;
    onAgregar(limpio);
    setTexto('');
  };

  return (
    <div className="flex gap-2 mt-2">
      <input
        id={id}
        className={inp}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={!habilitado}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          // El asistente no es un <form>: Enter se maneja a mano para que
          // agregar no obligue a soltar el teclado.
          if (e.key !== 'Enter') return;
          e.preventDefault();
          agregar();
        }}
      />
      <Btn variant="outline" disabled={!puedeAgregar} onClick={agregar}>
        Agregar
      </Btn>
    </div>
  );
}
