-- Migration: add_incidencia_and_clave
-- NOTE: This migration was created as a baseline because these changes were applied
-- directly to the database via raw SQL before being added to the migration history.
-- Running this file against an already-updated DB is safe (uses IF NOT EXISTS / DO $$ guards).

-- Add `clave` column to usuario if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuario' AND column_name = 'clave'
  ) THEN
    ALTER TABLE "public"."usuario" ADD COLUMN "clave" VARCHAR(255);
  END IF;
END $$;

-- Add unique index on usuario.clave if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'usuario' AND indexname = 'usuario_clave_key'
  ) THEN
    CREATE UNIQUE INDEX "usuario_clave_key" ON "public"."usuario"("clave");
  END IF;
END $$;

-- Create incidencia table if it doesn't exist
CREATE TABLE IF NOT EXISTS "public"."incidencia" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "quincena" INTEGER NOT NULL,
    "fecha" TIMESTAMP(6),
    "entrada_turno" VARCHAR(10),
    "salida_turno" VARCHAR(10),
    "tiempo_turno" INTEGER,
    "observaciones" TEXT,
    "entrada_comida" VARCHAR(10),
    "salida_comida" VARCHAR(10),
    "observaciones_comida" TEXT,
    CONSTRAINT "incidencia_pkey" PRIMARY KEY ("id")
);

-- Add index on incidencia.usuarioId if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'incidencia' AND indexname = 'incidencia_usuarioId_idx'
  ) THEN
    CREATE INDEX "incidencia_usuarioId_idx" ON "public"."incidencia"("usuarioId");
  END IF;
END $$;

-- Add foreign key on incidencia.usuarioId if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'incidencia'
      AND constraint_name = 'incidencia_usuarioId_fkey'
  ) THEN
    ALTER TABLE "public"."incidencia"
      ADD CONSTRAINT "incidencia_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "public"."usuario"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
