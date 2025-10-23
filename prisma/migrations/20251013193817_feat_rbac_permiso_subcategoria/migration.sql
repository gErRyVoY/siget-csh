/*
  Warnings:

  - A unique constraint covering the columns `[rolId,categoriaId,subcategoriaId]` on the table `permiso_categoria` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."permiso_categoria" DROP CONSTRAINT "permiso_categoria_categoriaId_fkey";

-- DropIndex
DROP INDEX "public"."permiso_categoria_rolId_categoriaId_key";

-- AlterTable
ALTER TABLE "public"."permiso_categoria" ADD COLUMN     "subcategoriaId" INTEGER,
ALTER COLUMN "categoriaId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "permiso_categoria_rolId_categoriaId_subcategoriaId_key" ON "public"."permiso_categoria"("rolId", "categoriaId", "subcategoriaId");

-- AddForeignKey
ALTER TABLE "public"."permiso_categoria" ADD CONSTRAINT "permiso_categoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permiso_categoria" ADD CONSTRAINT "permiso_categoria_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "public"."subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
