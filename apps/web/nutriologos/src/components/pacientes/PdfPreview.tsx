'use client';

import { Download, ExternalLink, FileText, X } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';

type PdfPreviewProps = {
  planId: string;
  onClose: () => void;
};

/**
 * Previsualiza exactamente el documento que entrega el servidor.
 *
 * El navegador no reconstruye una versión HTML: tanto el iframe como la
 * descarga apuntan al mismo endpoint PDF autenticado.
 */
export function PdfPreview({ planId, onClose }: PdfPreviewProps) {
  const pdfUrl = `/api/v1/meal_plans/${planId}/pdf`;

  return (
    <Modal wide>
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white">
              <FileText size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-medium text-emerald-950">
                Vista previa del plan
              </div>
              <div className="truncate text-xs text-stone-500">Documento con marca blanca</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Cerrar vista previa del PDF"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-200">
          <iframe
            className="h-[62vh] min-h-[420px] w-full bg-white"
            src={pdfUrl}
            title="Vista previa del plan alimenticio"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-xs text-stone-500">
            El archivo incluye la marca guardada en tu perfil y los valores persistidos del plan.
          </p>
          <div className="flex gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 px-3 py-2 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-50"
              aria-label="Abrir PDF del plan en otra pestaña"
            >
              <ExternalLink size={14} aria-hidden="true" />
              Abrir
            </a>
            <a
              href={`${pdfUrl}?download=1`}
              download
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-800"
              aria-label="Descargar PDF del plan"
            >
              <Download size={14} aria-hidden="true" />
              Descargar PDF
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
}
