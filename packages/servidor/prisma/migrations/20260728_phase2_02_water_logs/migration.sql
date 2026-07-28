-- Fase 2 (app de pacientes): meta y registro diario de agua.
--
-- La meta tiene default para que las preferencias existentes sigan siendo
-- válidas. La llave única permite el upsert idempotente de un solo renglón por
-- paciente y día.
ALTER TABLE "food_preferences"
ADD COLUMN "meta_agua_vasos" INTEGER NOT NULL DEFAULT 8;

CREATE TABLE "water_logs" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "vasos" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "water_logs_patient_id_fecha_key"
ON "water_logs"("patient_id", "fecha");

ALTER TABLE "water_logs"
ADD CONSTRAINT "water_logs_patient_id_fkey"
FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
