-- Fase 2 (app de pacientes): datos nutricionales del registro libre.
--
-- Calorías y macros son nullables porque los registros históricos del panel
-- no los contienen. `origen` tiene un default compatible con el código
-- anterior, que no envía este campo.
ALTER TABLE "meal_logs"
  ADD COLUMN "calorias" INTEGER,
  ADD COLUMN "proteina_g" DOUBLE PRECISION,
  ADD COLUMN "carbos_g" DOUBLE PRECISION,
  ADD COLUMN "grasa_g" DOUBLE PRECISION,
  ADD COLUMN "origen" "content_origin" NOT NULL DEFAULT 'manual',
  ADD COLUMN "hora" TIMESTAMP(3);
