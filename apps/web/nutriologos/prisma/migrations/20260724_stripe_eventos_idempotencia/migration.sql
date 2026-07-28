-- Fase 7 (Stripe). Ambos cambios son aditivos: el código anterior los ignora y
-- el nuevo los necesita, así que despliegue y migración pueden ir en cualquier
-- orden (expand-contract, sin fase de contracción pendiente).

-- Precio contratado, para distinguir Pro mensual de Pro anual al mostrar el plan.
ALTER TABLE "subscriptions"
ADD COLUMN "stripe_price_id" TEXT;

-- Bitácora de eventos de Stripe ya procesados. Stripe reintenta la entrega ante
-- cualquier respuesta que no sea 2xx y puede repetir un evento sin que nada
-- haya fallado; la llave primaria es la que hace idempotente al webhook.
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- Para poder purgar los eventos viejos sin escanear la tabla completa.
CREATE INDEX "stripe_events_processed_at_idx" ON "stripe_events"("processed_at");
