/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `empresa` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "empresa_slug_key" ON "public"."empresa"("slug");
