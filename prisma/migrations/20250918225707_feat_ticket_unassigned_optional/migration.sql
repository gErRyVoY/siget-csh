-- DropForeignKey
ALTER TABLE "public"."ticket" DROP CONSTRAINT "ticket_atiendeId_fkey";

-- AlterTable
ALTER TABLE "public"."ticket" ALTER COLUMN "atiendeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."ticket" ADD CONSTRAINT "ticket_atiendeId_fkey" FOREIGN KEY ("atiendeId") REFERENCES "public"."usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
