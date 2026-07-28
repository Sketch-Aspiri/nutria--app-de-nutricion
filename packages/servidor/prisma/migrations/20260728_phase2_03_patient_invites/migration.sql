-- Fase 2 (app de pacientes): invitaciones de activación.
--
-- Solo se persiste el hash del token. La caducidad y el uso único se aplicarán
-- en la fase de identidad; los índices dejan preparado ese flujo sin exponer
-- el secreto en claro.
CREATE TABLE "patient_invites" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patient_invites_token_hash_key"
ON "patient_invites"("token_hash");

CREATE INDEX "patient_invites_patient_id_idx"
ON "patient_invites"("patient_id");

ALTER TABLE "patient_invites"
ADD CONSTRAINT "patient_invites_patient_id_fkey"
FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
