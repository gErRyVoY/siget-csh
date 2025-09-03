/*
  Warnings:

  - The `comentario` column on the `historial_solicitud` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."historial_solicitud" DROP COLUMN "comentario",
ADD COLUMN     "comentario" JSONB;
