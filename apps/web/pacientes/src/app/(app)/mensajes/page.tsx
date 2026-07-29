import { MessageCircle } from 'lucide-react';

import { EstadoVacio, Pantalla } from '@/components/ui/Pantalla';

export const metadata = { title: 'Mensajes — nutria' };

/** Cascarón del chat. La fase 10 conecta el hilo real con `/me/messages`. */
export default function MensajesPage() {
  return (
    <Pantalla titulo="Mensajes" subtitulo="Tu conversación con tu nutrióloga">
      <EstadoVacio
        icono={MessageCircle}
        titulo="Aquí vas a hablar con tu nutrióloga"
        descripcion="Dudas del plan, cambios de horario o cómo te sentiste esta semana. Te responde ella, no un asistente."
      />
    </Pantalla>
  );
}
