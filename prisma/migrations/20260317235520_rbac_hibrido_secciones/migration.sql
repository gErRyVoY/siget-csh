-- CreateTable
CREATE TABLE "seccion" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "identificador" VARCHAR(100) NOT NULL,
    "grupo" VARCHAR(50),
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "seccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso_rol_seccion" (
    "id" SERIAL NOT NULL,
    "rolId" INTEGER NOT NULL,
    "seccionId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permiso_rol_seccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso_usuario_seccion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "seccionId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permiso_usuario_seccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seccion_identificador_key" ON "seccion"("identificador");

-- CreateIndex
CREATE INDEX "permiso_rol_seccion_rolId_activo_idx" ON "permiso_rol_seccion"("rolId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_rol_seccion_rolId_seccionId_key" ON "permiso_rol_seccion"("rolId", "seccionId");

-- CreateIndex
CREATE INDEX "permiso_usuario_seccion_usuarioId_activo_idx" ON "permiso_usuario_seccion"("usuarioId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_usuario_seccion_usuarioId_seccionId_key" ON "permiso_usuario_seccion"("usuarioId", "seccionId");

-- AddForeignKey
ALTER TABLE "permiso_rol_seccion" ADD CONSTRAINT "permiso_rol_seccion_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permiso_rol_seccion" ADD CONSTRAINT "permiso_rol_seccion_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "seccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permiso_usuario_seccion" ADD CONSTRAINT "permiso_usuario_seccion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permiso_usuario_seccion" ADD CONSTRAINT "permiso_usuario_seccion_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "seccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
