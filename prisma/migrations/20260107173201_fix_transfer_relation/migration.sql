-- DropForeignKey
ALTER TABLE "public"."traslado" DROP CONSTRAINT "traslado_bloqueId_fkey";

-- AlterTable
ALTER TABLE "public"."traslado" ADD COLUMN     "bloque_nombre" VARCHAR(20),
ALTER COLUMN "bloqueId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."traslado" ADD CONSTRAINT "traslado_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "public"."bloque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
