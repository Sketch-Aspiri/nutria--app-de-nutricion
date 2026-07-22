-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('nutritionist', 'admin', 'end_user');

-- CreateEnum
CREATE TYPE "subscription_plan" AS ENUM ('free', 'pro', 'clinica');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'unpaid');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('femenino', 'masculino', 'otro');

-- CreateEnum
CREATE TYPE "patient_status" AS ENUM ('activo', 'archivado');

-- CreateEnum
CREATE TYPE "activity_level" AS ENUM ('sedentario', 'ligero', 'moderado', 'activo', 'muy_activo');

-- CreateEnum
CREATE TYPE "goal" AS ENUM ('perdida_de_grasa', 'ganancia_muscular', 'mantenimiento', 'control_de_diabetes', 'mejora_deportiva', 'otro');

-- CreateEnum
CREATE TYPE "content_origin" AS ENUM ('manual', 'ia', 'plantilla');

-- CreateEnum
CREATE TYPE "meal_plan_status" AS ENUM ('borrador', 'activo', 'archivado');

-- CreateEnum
CREATE TYPE "recipe_status" AS ENUM ('sugerida', 'enviada', 'en_curso');

-- CreateEnum
CREATE TYPE "food_source" AS ENUM ('incmnsz', 'usda', 'off', 'propia');

-- CreateEnum
CREATE TYPE "appointment_type" AS ENUM ('presencial', 'videollamada');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('programada', 'completada', 'cancelada', 'no_asistio');

-- CreateEnum
CREATE TYPE "message_sender" AS ENUM ('nutritionist', 'patient');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('pendiente', 'pagada', 'cancelada');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'nutritionist',
    "name" TEXT,
    "image" TEXT,
    "email_verified" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutritionist_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "cedula_profesional" TEXT,
    "telefono" TEXT,
    "especialidad" TEXT,
    "bio" TEXT,
    "marca_nombre" TEXT,
    "marca_color" TEXT NOT NULL DEFAULT '#065f46',
    "marca_logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutritionist_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "plan" "subscription_plan" NOT NULL DEFAULT 'free',
    "status" "subscription_status" NOT NULL DEFAULT 'active',
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mes" TEXT NOT NULL,
    "generaciones" INTEGER NOT NULL DEFAULT 0,
    "tokens_entrada" INTEGER NOT NULL DEFAULT 0,
    "tokens_salida" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "nutritionist_id" UUID NOT NULL,
    "user_id" UUID,
    "nombre" TEXT NOT NULL,
    "fecha_nacimiento" DATE,
    "genero" "gender" NOT NULL DEFAULT 'otro',
    "email" TEXT,
    "telefono" TEXT,
    "foto_url" TEXT,
    "estado" "patient_status" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "condiciones" JSONB NOT NULL DEFAULT '[]',
    "antecedentes" TEXT,
    "medicamentos" TEXT,
    "nivel_actividad" "activity_level" NOT NULL DEFAULT 'moderado',
    "objetivo" "goal" NOT NULL DEFAULT 'mantenimiento',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anthropometry_measurements" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "peso_kg" DOUBLE PRECISION,
    "altura_cm" DOUBLE PRECISION,
    "cintura_cm" DOUBLE PRECISION,
    "cadera_cm" DOUBLE PRECISION,
    "grasa_pct" DOUBLE PRECISION,
    "musculo_pct" DOUBLE PRECISION,
    "pliegues" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anthropometry_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_preferences" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "tipo_dieta" TEXT,
    "alergias" JSONB NOT NULL DEFAULT '[]',
    "disgustos" TEXT,
    "comidas_por_dia" INTEGER NOT NULL DEFAULT 3,
    "presupuesto_tiempo" TEXT NOT NULL DEFAULT 'Medio',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_notes" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "hallazgos" TEXT,
    "plan" TEXT,
    "seguimiento" TEXT,
    "transcripcion_url" TEXT,
    "origen" "content_origin" NOT NULL DEFAULT 'manual',
    "firmada_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foods" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre_normalizado" TEXT NOT NULL,
    "grupo_smae" TEXT NOT NULL,
    "subgrupo" TEXT,
    "porcion_descripcion" TEXT NOT NULL,
    "porcion_gramos" DOUBLE PRECISION NOT NULL,
    "energia_kcal" DOUBLE PRECISION NOT NULL,
    "proteina_g" DOUBLE PRECISION NOT NULL,
    "lipidos_g" DOUBLE PRECISION NOT NULL,
    "saturadas_g" DOUBLE PRECISION,
    "colesterol_mg" DOUBLE PRECISION,
    "carbohidratos_g" DOUBLE PRECISION NOT NULL,
    "fibra_g" DOUBLE PRECISION,
    "azucar_g" DOUBLE PRECISION,
    "sodio_mg" DOUBLE PRECISION,
    "potasio_mg" DOUBLE PRECISION,
    "calcio_mg" DOUBLE PRECISION,
    "hierro_mg" DOUBLE PRECISION,
    "acido_folico_ug" DOUBLE PRECISION,
    "vitamina_a_ug" DOUBLE PRECISION,
    "vitamina_c_mg" DOUBLE PRECISION,
    "indice_glicemico" INTEGER,
    "equivalentes" JSONB NOT NULL DEFAULT '{}',
    "imagen_url" TEXT,
    "fuente" "food_source" NOT NULL DEFAULT 'propia',
    "fuente_ref" TEXT,
    "es_publico" BOOLEAN NOT NULL DEFAULT true,
    "nutritionist_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plans" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "estado" "meal_plan_status" NOT NULL DEFAULT 'borrador',
    "calorias_diarias" INTEGER NOT NULL,
    "proteina_g" INTEGER NOT NULL,
    "carbos_g" INTEGER NOT NULL,
    "grasa_g" INTEGER NOT NULL,
    "nota" TEXT,
    "origen" "content_origin" NOT NULL DEFAULT 'manual',
    "calculo_snapshot" JSONB,
    "compartido_at" TIMESTAMP(3),
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_meals" (
    "id" UUID NOT NULL,
    "meal_plan_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "horario" TEXT,
    "descripcion" TEXT,

    CONSTRAINT "meal_plan_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_items" (
    "id" UUID NOT NULL,
    "meal_id" UUID NOT NULL,
    "food_id" UUID,
    "descripcion_libre" TEXT,
    "cantidad_porciones" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "energia_kcal" DOUBLE PRECISION NOT NULL,
    "proteina_g" DOUBLE PRECISION NOT NULL,
    "carbohidratos_g" DOUBLE PRECISION NOT NULL,
    "lipidos_g" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "meal_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_templates" (
    "id" UUID NOT NULL,
    "nutritionist_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "objetivo" "goal" NOT NULL DEFAULT 'mantenimiento',
    "calorias" INTEGER NOT NULL,
    "descripcion" TEXT,
    "estructura" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "nutritionist_id" UUID NOT NULL,
    "patient_id" UUID,
    "nombre" TEXT NOT NULL,
    "ingredientes" JSONB NOT NULL DEFAULT '[]',
    "pasos" TEXT,
    "calorias" INTEGER,
    "porciones" INTEGER NOT NULL DEFAULT 1,
    "origen" "content_origin" NOT NULL DEFAULT 'manual',
    "estado" "recipe_status" NOT NULL DEFAULT 'sugerida',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_logs" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "meal_plan_meal_id" UUID,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "foto_url" TEXT,
    "comentario_paciente" TEXT,
    "comentario_nutriologo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_logs" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "peso_kg" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_logs" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "duracion_min" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_plans" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "origen" "content_origin" NOT NULL DEFAULT 'manual',
    "compartido_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "nutritionist_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "duracion_min" INTEGER NOT NULL DEFAULT 45,
    "tipo" "appointment_type" NOT NULL DEFAULT 'presencial',
    "estado" "appointment_status" NOT NULL DEFAULT 'programada',
    "notas" TEXT,
    "video_url" TEXT,
    "recordatorio_enviado_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "nutritionist_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "emisor" "message_sender" NOT NULL,
    "texto" TEXT NOT NULL,
    "leido_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "nutritionist_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto_centavos" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "estado" "invoice_status" NOT NULL DEFAULT 'pendiente',
    "metodo" TEXT,
    "requiere_cfdi" BOOLEAN NOT NULL DEFAULT false,
    "cfdi_status" TEXT,
    "pagada_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "accion" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "recurso_id" TEXT,
    "ip" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "nutritionist_profiles_user_id_key" ON "nutritionist_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_user_id_mes_key" ON "ai_usage"("user_id", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE INDEX "patients_nutritionist_id_estado_idx" ON "patients"("nutritionist_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_patient_id_key" ON "medical_records"("patient_id");

-- CreateIndex
CREATE INDEX "anthropometry_measurements_patient_id_fecha_idx" ON "anthropometry_measurements"("patient_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "food_preferences_patient_id_key" ON "food_preferences"("patient_id");

-- CreateIndex
CREATE INDEX "consultation_notes_patient_id_fecha_idx" ON "consultation_notes"("patient_id", "fecha");

-- CreateIndex
CREATE INDEX "foods_nombre_normalizado_idx" ON "foods"("nombre_normalizado");

-- CreateIndex
CREATE INDEX "foods_grupo_smae_idx" ON "foods"("grupo_smae");

-- CreateIndex
CREATE INDEX "foods_nutritionist_id_idx" ON "foods"("nutritionist_id");

-- CreateIndex
CREATE INDEX "meal_plans_patient_id_estado_idx" ON "meal_plans"("patient_id", "estado");

-- CreateIndex
CREATE INDEX "meal_plan_meals_meal_plan_id_orden_idx" ON "meal_plan_meals"("meal_plan_id", "orden");

-- CreateIndex
CREATE INDEX "meal_plan_items_meal_id_idx" ON "meal_plan_items"("meal_id");

-- CreateIndex
CREATE INDEX "plan_templates_nutritionist_id_idx" ON "plan_templates"("nutritionist_id");

-- CreateIndex
CREATE INDEX "recipes_nutritionist_id_idx" ON "recipes"("nutritionist_id");

-- CreateIndex
CREATE INDEX "recipes_patient_id_idx" ON "recipes"("patient_id");

-- CreateIndex
CREATE INDEX "meal_logs_patient_id_fecha_idx" ON "meal_logs"("patient_id", "fecha");

-- CreateIndex
CREATE INDEX "weight_logs_patient_id_fecha_idx" ON "weight_logs"("patient_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "weight_logs_patient_id_fecha_key" ON "weight_logs"("patient_id", "fecha");

-- CreateIndex
CREATE INDEX "exercise_logs_patient_id_fecha_idx" ON "exercise_logs"("patient_id", "fecha");

-- CreateIndex
CREATE INDEX "activity_plans_patient_id_idx" ON "activity_plans"("patient_id");

-- CreateIndex
CREATE INDEX "appointments_nutritionist_id_inicio_idx" ON "appointments"("nutritionist_id", "inicio");

-- CreateIndex
CREATE INDEX "appointments_patient_id_inicio_idx" ON "appointments"("patient_id", "inicio");

-- CreateIndex
CREATE INDEX "messages_patient_id_created_at_idx" ON "messages"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "invoices_nutritionist_id_estado_idx" ON "invoices"("nutritionist_id", "estado");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_recurso_recurso_id_idx" ON "audit_logs"("recurso", "recurso_id");

-- AddForeignKey
ALTER TABLE "nutritionist_profiles" ADD CONSTRAINT "nutritionist_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_nutritionist_id_fkey" FOREIGN KEY ("nutritionist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anthropometry_measurements" ADD CONSTRAINT "anthropometry_measurements_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_preferences" ADD CONSTRAINT "food_preferences_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foods" ADD CONSTRAINT "foods_nutritionist_id_fkey" FOREIGN KEY ("nutritionist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_meals" ADD CONSTRAINT "meal_plan_meals_meal_plan_id_fkey" FOREIGN KEY ("meal_plan_id") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meal_plan_meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_templates" ADD CONSTRAINT "plan_templates_nutritionist_id_fkey" FOREIGN KEY ("nutritionist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_nutritionist_id_fkey" FOREIGN KEY ("nutritionist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_meal_plan_meal_id_fkey" FOREIGN KEY ("meal_plan_meal_id") REFERENCES "meal_plan_meals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_plans" ADD CONSTRAINT "activity_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_nutritionist_id_fkey" FOREIGN KEY ("nutritionist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_nutritionist_id_fkey" FOREIGN KEY ("nutritionist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_nutritionist_id_fkey" FOREIGN KEY ("nutritionist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

