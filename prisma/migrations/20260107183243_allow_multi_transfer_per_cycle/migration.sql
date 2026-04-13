-- DropIndex
DROP INDEX "traslado_matricula_key";

-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "cicloId" INTEGER;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "ciclo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
