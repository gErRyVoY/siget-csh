-- AlterTable
ALTER TABLE "public"."traslado" ADD COLUMN     "descripcion_calif" TEXT,
ADD COLUMN     "descripcion_docs" TEXT,
ADD COLUMN     "descripcion_edocta" TEXT,
ADD COLUMN     "validacion_calif" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validacion_docs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validacion_edocta" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."usuario" ADD COLUMN     "auditor_docs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auditor_req" BOOLEAN NOT NULL DEFAULT false;
