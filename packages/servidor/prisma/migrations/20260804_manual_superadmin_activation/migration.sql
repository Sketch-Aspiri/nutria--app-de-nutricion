-- El enum conserva `free` por compatibilidad; las cuentas nuevas usan Pro.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'superadmin';

ALTER TABLE "subscriptions"
ADD COLUMN "access_expires_at" TIMESTAMP(3),
ADD COLUMN "last_activated_at" TIMESTAMP(3),
ADD COLUMN "last_activated_by_user_id" UUID,
ADD COLUMN "activation_note" TEXT;

UPDATE "subscriptions"
SET
  "access_expires_at" = "created_at" + INTERVAL '1 month',
  "plan" = 'pro'
WHERE "access_expires_at" IS NULL;

ALTER TABLE "subscriptions"
ALTER COLUMN "access_expires_at" SET NOT NULL,
ALTER COLUMN "plan" SET DEFAULT 'pro';

ALTER TABLE "subscriptions"
ADD CONSTRAINT "subscriptions_last_activated_by_user_id_fkey"
FOREIGN KEY ("last_activated_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "subscriptions_access_expires_at_idx"
ON "subscriptions"("access_expires_at");

CREATE INDEX "subscriptions_last_activated_by_user_id_idx"
ON "subscriptions"("last_activated_by_user_id");
