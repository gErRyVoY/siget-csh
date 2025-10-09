-- CreateTable
CREATE TABLE "public"."permiso" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_PermisoToRol" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PermisoToRol_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "permiso_nombre_key" ON "public"."permiso"("nombre");

-- CreateIndex
CREATE INDEX "_PermisoToRol_B_index" ON "public"."_PermisoToRol"("B");

-- AddForeignKey
ALTER TABLE "public"."_PermisoToRol" ADD CONSTRAINT "_PermisoToRol_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PermisoToRol" ADD CONSTRAINT "_PermisoToRol_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
