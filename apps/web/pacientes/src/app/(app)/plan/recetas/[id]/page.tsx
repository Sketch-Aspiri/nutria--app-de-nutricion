import { RecetaDetalle } from '@/features/plan/RecetaDetalle';

export const metadata = { title: 'Receta — nutria' };

/**
 * Detalle de una receta.
 *
 * El título del documento es genérico a propósito: poner el nombre de la receta
 * exigiría leerla en el servidor y ese texto acabaría en el historial del
 * navegador y en el conmutador de apps del teléfono. Es información de salud
 * del paciente y no tiene por qué quedar ahí.
 */
export default async function RecetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecetaDetalle recetaId={id} />;
}
