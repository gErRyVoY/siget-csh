-- CreateTable
CREATE TABLE "public"."permiso_categoria" (
    "id" SERIAL NOT NULL,
    "rolId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,

    CONSTRAINT "permiso_categoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permiso_categoria_rolId_categoriaId_key" ON "public"."permiso_categoria"("rolId", "categoriaId");

-- AddForeignKey
ALTER TABLE "public"."permiso_categoria" ADD CONSTRAINT "permiso_categoria_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "public"."rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permiso_categoria" ADD CONSTRAINT "permiso_categoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
