-- DropForeignKey
ALTER TABLE "public"."asignaciones_categorias" DROP CONSTRAINT "asignaciones_categorias_subcategoriaId_fkey";

-- AlterTable
ALTER TABLE "public"."asignaciones_categorias" ALTER COLUMN "subcategoriaId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."asignaciones_categorias" ADD CONSTRAINT "asignaciones_categorias_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "public"."subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
