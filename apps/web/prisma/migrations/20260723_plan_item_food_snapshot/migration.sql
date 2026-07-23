-- Expand: conserva la identidad descriptiva del alimento sin modificar aún
-- la FK existente. La columna nullable permite desplegar código y migración
-- en cualquier orden; los items nuevos siempre la completan.
ALTER TABLE "meal_plan_items"
ADD COLUMN "food_snapshot" JSONB;

-- Backfill de planes existentes mientras la relación con foods sigue viva.
UPDATE "meal_plan_items" AS item
SET "food_snapshot" = jsonb_build_object(
  'id', food."id",
  'nombre', food."nombre",
  'grupo', food."grupo_smae",
  'porcion_descripcion', food."porcion_descripcion",
  'porcion_gramos', food."porcion_gramos",
  'imagen_url', food."imagen_url"
)
FROM "foods" AS food
WHERE item."food_id" = food."id"
  AND item."food_snapshot" IS NULL;
