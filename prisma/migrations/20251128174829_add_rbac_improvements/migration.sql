/*
  Warnings:

  - A unique constraint covering the columns `[atiendeId,categoriaId,subcategoriaId]` on the table `asignaciones_categorias` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `asignaciones_categorias` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `permiso_categoria` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."asignaciones_categorias" DROP CONSTRAINT "asignaciones_categorias_atiendeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."asignaciones_categorias" DROP CONSTRAINT "asignaciones_categorias_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."asignaciones_categorias" DROP CONSTRAINT "asignaciones_categorias_subcategoriaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."permiso_categoria" DROP CONSTRAINT "permiso_categoria_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."permiso_categoria" DROP CONSTRAINT "permiso_categoria_rolId_fkey";

-- DropForeignKey
ALTER TABLE "public"."permiso_categoria" DROP CONSTRAINT "permiso_categoria_subcategoriaId_fkey";

-- AlterTable
ALTER TABLE "public"."asignaciones_categorias" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "prioridad" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "activo" SET DEFAULT true;

-- AlterTable
ALTER TABLE "public"."permiso_categoria" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "prioridad" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "asignaciones_categorias_categoriaId_subcategoriaId_activo_idx" ON "public"."asignaciones_categorias"("categoriaId", "subcategoriaId", "activo");

-- CreateIndex
CREATE INDEX "asignaciones_categorias_atiendeId_activo_idx" ON "public"."asignaciones_categorias"("atiendeId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_categorias_atiendeId_categoriaId_subcategoriaI_key" ON "public"."asignaciones_categorias"("atiendeId", "categoriaId", "subcategoriaId");

-- CreateIndex
CREATE INDEX "permiso_categoria_categoriaId_subcategoriaId_activo_idx" ON "public"."permiso_categoria"("categoriaId", "subcategoriaId", "activo");

-- CreateIndex
CREATE INDEX "permiso_categoria_rolId_activo_idx" ON "public"."permiso_categoria"("rolId", "activo");

-- AddForeignKey
ALTER TABLE "public"."asignaciones_categorias" ADD CONSTRAINT "asignaciones_categorias_atiendeId_fkey" FOREIGN KEY ("atiendeId") REFERENCES "public"."usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asignaciones_categorias" ADD CONSTRAINT "asignaciones_categorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asignaciones_categorias" ADD CONSTRAINT "asignaciones_categorias_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "public"."subcategoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permiso_categoria" ADD CONSTRAINT "permiso_categoria_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "public"."rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permiso_categoria" ADD CONSTRAINT "permiso_categoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permiso_categoria" ADD CONSTRAINT "permiso_categoria_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "public"."subcategoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
