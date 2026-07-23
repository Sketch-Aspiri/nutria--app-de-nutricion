import type { Cita, Factura, Marca, MensajeChat, PlantillaPlan } from '@nutria/shared';

/**
 * Datos de arranque de las secciones que todavía no viven en la base.
 *
 * Los pacientes ya no están aquí: se leen de PostgreSQL. Agenda, mensajes y
 * facturación arrancan vacíos porque sus registros de demostración apuntaban a
 * pacientes ficticios que ya no existen; se migran en las fases 6 y 7.
 */

export const CITAS_DEMO: Cita[] = [];

export const MENSAJES_DEMO: Record<string, MensajeChat[]> = {};

export const FACTURAS_DEMO: Factura[] = [];

export const PLANTILLAS_DEMO: PlantillaPlan[] = [
  {
    id: 1,
    nombre: 'Déficit moderado — omnívoro',
    objetivo: 'Pérdida de grasa',
    calorias: 1600,
    descripcion: '4 comidas, alto en proteína, base de verduras y cereales integrales.',
  },
  {
    id: 2,
    nombre: 'Volumen limpio — deportista',
    objetivo: 'Ganancia muscular',
    calorias: 2600,
    descripcion: '5 comidas, superávit ligero, carbohidratos alrededor del entrenamiento.',
  },
];

export const MARCA_DEMO: Marca = {
  nombre: 'nutria',
  profesional: 'Nutrióloga certificada',
  color: '#166534',
  logo: null,
};
