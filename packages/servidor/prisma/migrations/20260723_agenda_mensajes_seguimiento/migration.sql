-- Fase 6: agenda, mensajes y seguimiento.
--
-- Las tablas ya existían desde `0_init`; lo que falta es la zona horaria del
-- consultorio y los índices que hacen viables las consultas nuevas.

-- La agenda, los recordatorios y el día natural de la adherencia se resuelven
-- en la zona del nutriólogo. Con DEFAULT, las cuentas existentes quedan en la
-- zona de México sin necesidad de backfill ni de un paso de contract posterior.
ALTER TABLE "nutritionist_profiles"
ADD COLUMN "zona_horaria" TEXT NOT NULL DEFAULT 'America/Mexico_City';

-- El cron de recordatorios barre las citas próximas de toda la plataforma, sin
-- filtrar por nutriólogo: el índice existente (nutritionist_id, inicio) no le
-- sirve y haría un scan completo cada 15 minutos.
CREATE INDEX "appointments_estado_inicio_idx" ON "appointments" ("estado", "inicio");

-- La bandeja de mensajes lista la última línea de cada conversación del
-- nutriólogo; el índice existente está ordenado por paciente.
CREATE INDEX "messages_nutritionist_id_created_at_idx" ON "messages" ("nutritionist_id", "created_at");

-- Desde cuándo rige el plan: es el primer día que la adherencia le exige al
-- paciente. `created_at` es la fecha del borrador y `updated_at` cambia con
-- cada edición, así que ninguno sirve.
ALTER TABLE "meal_plans"
ADD COLUMN "activado_at" TIMESTAMP(3);

-- Backfill de los planes ya activos. `updated_at` es la mejor aproximación
-- disponible a su activación; sin esto la adherencia de los pacientes actuales
-- arrancaría en null y el endpoint tendría que inventar una fecha.
UPDATE "meal_plans"
SET "activado_at" = "updated_at"
WHERE "estado" = 'activo'
  AND "activado_at" IS NULL;
