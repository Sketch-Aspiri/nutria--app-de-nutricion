-- Expand-only: registra la evidencia del aviso y del consentimiento sin
-- reinterpretar cuentas o expedientes históricos. Los valores existentes
-- quedan nulos hasta que la persona vuelva a consentir de forma verificable.
ALTER TABLE "users"
  ADD COLUMN "privacy_notice_accepted_at" TIMESTAMP(3),
  ADD COLUMN "privacy_notice_version" TEXT;

ALTER TABLE "patients"
  ADD COLUMN "sensitive_data_consent_at" TIMESTAMP(3),
  ADD COLUMN "sensitive_data_consent_version" TEXT,
  ADD COLUMN "sensitive_data_consent_method" TEXT,
  ADD COLUMN "privacy_notice_sent_at" TIMESTAMP(3);
