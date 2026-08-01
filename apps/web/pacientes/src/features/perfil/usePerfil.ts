'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import {
  cambiarPassword,
  type CambiarPasswordPayload,
  darDeBaja,
  descargarMisDatos,
  obtenerPerfil,
} from './api';

export const PERFIL_QUERY_KEY = ['me', 'perfil'] as const;

/**
 * El perfil casi no cambia durante una sesión —el nombre de la nutrióloga, el
 * consultorio—, así que se cachea largo. El encabezado del hilo no debería
 * volver a pedirlo cada vez que el paciente entra a Mensajes.
 */
const TREINTA_MINUTOS = 30 * 60 * 1000;

export function usePerfil() {
  return useQuery({
    queryKey: PERFIL_QUERY_KEY,
    queryFn: obtenerPerfil,
    staleTime: TREINTA_MINUTOS,
  });
}

/**
 * Cambio de contraseña.
 *
 * No invalida el perfil ni ninguna caché: la contraseña no se muestra en
 * ninguna pantalla, así que no hay nada que refrescar.
 */
export function useCambiarPassword() {
  return useMutation({
    mutationFn: (payload: CambiarPasswordPayload) => cambiarPassword(payload),
  });
}

/**
 * Descarga de los propios datos.
 *
 * El `objectURL` se revoca en cuanto el navegador toma el archivo: mantenerlo
 * vivo dejaría el JSON con datos de salud en memoria hasta cerrar la pestaña.
 */
export function useDescargarMisDatos() {
  return useMutation({
    mutationFn: async () => {
      const { url, nombreArchivo } = await descargarMisDatos();
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    },
  });
}

/**
 * Baja de la cuenta.
 *
 * No invalida caché ni la vacía: tras la baja la sesión ya no vale y quien la
 * llama manda al paciente fuera. Refrescar una consulta con una sesión muerta
 * solo produciría un 401 y un parpadeo de error sobre una pantalla de
 * despedida.
 */
export function useDarDeBaja() {
  return useMutation({
    mutationFn: (password: string) => darDeBaja({ password, confirmacion: true }),
  });
}
