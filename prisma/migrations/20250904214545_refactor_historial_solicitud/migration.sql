-- AlterTable
ALTER TABLE "public"."historial_solicitud" ADD COLUMN     "archivos" JSONB,
ADD COLUMN     "cambios" JSONB,
ALTER COLUMN "comentario" SET DATA TYPE TEXT;
