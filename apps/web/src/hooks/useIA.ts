'use client';

import { useMutation } from '@tanstack/react-query';

import { generarJSON, generarTexto } from '@/services/ia';

/** Mutación de texto libre generado por IA. */
export function useGenerarTexto() {
  return useMutation({
    mutationFn: ({ prompt, maxTokens }: { prompt: string; maxTokens?: number }) =>
      generarTexto(prompt, maxTokens),
  });
}

/** Mutación de JSON estructurado generado por IA. */
export function useGenerarJSON<T>() {
  return useMutation({
    mutationFn: ({ prompt, maxTokens }: { prompt: string; maxTokens?: number }) =>
      generarJSON<T>(prompt, maxTokens),
  });
}
