-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "foods_nombre_normalizado_trgm_idx" ON "foods" USING GIN ("nombre_normalizado" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "foods_fuente_fuente_ref_key" ON "foods"("fuente", "fuente_ref");

