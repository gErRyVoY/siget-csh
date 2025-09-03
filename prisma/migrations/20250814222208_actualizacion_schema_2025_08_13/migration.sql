-- CreateEnum
CREATE TYPE "public"."TipoEmpresa" AS ENUM ('Ejecutivo', 'Magno', 'Oficina', 'Social');

-- CreateEnum
CREATE TYPE "public"."NivelSoporte" AS ENUM ('S-1', 'S-2', 'S-3', 'Desarrollador', 'Marketing', 'Contador');

-- CreateEnum
CREATE TYPE "public"."Grado" AS ENUM ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', 'Seminario');

-- CreateEnum
CREATE TYPE "public"."Prioridad" AS ENUM ('Baja', 'Media', 'Alta', 'Urgente');

-- CreateEnum
CREATE TYPE "public"."TipoPlantillaCorreo" AS ENUM ('Alumno', 'Colaborador', 'Notificación sistema', 'Automatico', 'Vacaciones');

-- CreateEnum
CREATE TYPE "public"."EstatusCorreo" AS ENUM ('Enviado', 'Pendiente', 'Fallido');

-- CreateTable
CREATE TABLE "public"."empresa" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "tipo" "public"."TipoEmpresa" NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rol" (
    "id" SERIAL NOT NULL,
    "rol" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "nivel_soporte" "public"."NivelSoporte" NOT NULL,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."oferta" (
    "id" SERIAL NOT NULL,
    "descripcion" VARCHAR(50) NOT NULL,

    CONSTRAINT "oferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carrera" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(10) NOT NULL,
    "descripcion" VARCHAR(150) NOT NULL,
    "ofertaId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "carrera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usuario" (
    "id" SERIAL NOT NULL,
    "mail" VARCHAR(60) NOT NULL,
    "nombres" VARCHAR(50) NOT NULL,
    "apellidos" VARCHAR(50) NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "rolId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vacaciones" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_login" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horario_disponibilidad" JSONB,
    "carga_actual" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."logs" (
    "id" SERIAL NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "fecha" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalles" JSONB,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ciclo" (
    "id" SERIAL NOT NULL,
    "ciclo" VARCHAR(10) NOT NULL,
    "fecha_inicio" TIMESTAMP(6) NOT NULL,
    "fecha_fin" TIMESTAMP(6) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ciclo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bloque" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(60) NOT NULL,
    "grado" "public"."Grado" NOT NULL,
    "carreraId" INTEGER NOT NULL,
    "descripcion" VARCHAR(120) NOT NULL,
    "dias" VARCHAR(50) NOT NULL,
    "hora" VARCHAR(50) NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "campusId" INTEGER NOT NULL,

    CONSTRAINT "bloque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."descuento" (
    "id" SERIAL NOT NULL,
    "descripcion" VARCHAR(50) NOT NULL,
    "monto" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "descuento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."estatus" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "estatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categoria" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "nivel_soporte_requerido" "public"."NivelSoporte",
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subcategoria" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "parent_subcategoriaId" INTEGER,
    "nivel_soporte_requerido" "public"."NivelSoporte",
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "subcategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subcategoria_categorias" (
    "categoriaId" INTEGER NOT NULL,
    "subcategoriaId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "subcategoria_categorias_pkey" PRIMARY KEY ("categoriaId","subcategoriaId")
);

-- CreateTable
CREATE TABLE "public"."asignaciones_categorias" (
    "id" SERIAL NOT NULL,
    "atiendeId" INTEGER NOT NULL,
    "categoriaId" INTEGER,
    "subcategoriaId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "asignaciones_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket" (
    "id" SERIAL NOT NULL,
    "fechaalta" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaact" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estatusId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "subcategoriaId" INTEGER,
    "solicitanteId" INTEGER NOT NULL,
    "atiendeId" INTEGER NOT NULL,
    "prioridad" "public"."Prioridad" NOT NULL,
    "descripcion" TEXT,
    "empresaId" INTEGER NOT NULL,
    "archivado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_pago" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plan_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."traslado" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "folio" VARCHAR(10) NOT NULL,
    "matricula" VARCHAR(10) NOT NULL,
    "alumno" VARCHAR(100) NOT NULL,
    "origenId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "carreraId" INTEGER NOT NULL,
    "descuentoId" INTEGER NOT NULL,
    "bloqueId" INTEGER NOT NULL,
    "actualizacion" BOOLEAN NOT NULL DEFAULT false,
    "planpagoId" INTEGER,
    "auditor_docsId" INTEGER,
    "auditor_reqId" INTEGER,
    "especial" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "traslado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."historial_solicitud" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "estatusId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fecha_cambio" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,

    CONSTRAINT "historial_solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plantilla_correo" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "contenido" TEXT,
    "tipo" "public"."TipoPlantillaCorreo" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "plantilla_correo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notificaciones_correo" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "destinatarioId" INTEGER NOT NULL,
    "fecha_envio" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plantillaId" INTEGER NOT NULL,
    "estatus" "public"."EstatusCorreo" NOT NULL,
    "mensaje_error" TEXT,

    CONSTRAINT "notificaciones_correo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_mail_key" ON "public"."usuario"("mail");

-- CreateIndex
CREATE UNIQUE INDEX "bloque_clave_key" ON "public"."bloque"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "traslado_ticketId_key" ON "public"."traslado"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "traslado_folio_key" ON "public"."traslado"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "traslado_matricula_key" ON "public"."traslado"("matricula");

-- AddForeignKey
ALTER TABLE "public"."carrera" ADD CONSTRAINT "carrera_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "public"."oferta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario" ADD CONSTRAINT "usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario" ADD CONSTRAINT "usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "public"."rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."logs" ADD CONSTRAINT "logs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bloque" ADD CONSTRAINT "bloque_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "public"."carrera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bloque" ADD CONSTRAINT "bloque_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "public"."ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bloque" ADD CONSTRAINT "bloque_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "public"."empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subcategoria" ADD CONSTRAINT "subcategoria_parent_subcategoriaId_fkey" FOREIGN KEY ("parent_subcategoriaId") REFERENCES "public"."subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subcategoria_categorias" ADD CONSTRAINT "subcategoria_categorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subcategoria_categorias" ADD CONSTRAINT "subcategoria_categorias_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "public"."subcategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asignaciones_categorias" ADD CONSTRAINT "asignaciones_categorias_atiendeId_fkey" FOREIGN KEY ("atiendeId") REFERENCES "public"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asignaciones_categorias" ADD CONSTRAINT "asignaciones_categorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asignaciones_categorias" ADD CONSTRAINT "asignaciones_categorias_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "public"."subcategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket" ADD CONSTRAINT "ticket_estatusId_fkey" FOREIGN KEY ("estatusId") REFERENCES "public"."estatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket" ADD CONSTRAINT "ticket_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket" ADD CONSTRAINT "ticket_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "public"."subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket" ADD CONSTRAINT "ticket_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "public"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket" ADD CONSTRAINT "ticket_atiendeId_fkey" FOREIGN KEY ("atiendeId") REFERENCES "public"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket" ADD CONSTRAINT "ticket_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traslado" ADD CONSTRAINT "traslado_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traslado" ADD CONSTRAINT "traslado_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "public"."empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traslado" ADD CONSTRAINT "traslado_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "public"."empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traslado" ADD CONSTRAINT "traslado_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "public"."carrera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traslado" ADD CONSTRAINT "traslado_descuentoId_fkey" FOREIGN KEY ("descuentoId") REFERENCES "public"."descuento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traslado" ADD CONSTRAINT "traslado_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "public"."bloque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traslado" ADD CONSTRAINT "traslado_planpagoId_fkey" FOREIGN KEY ("planpagoId") REFERENCES "public"."plan_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traslado" ADD CONSTRAINT "traslado_auditor_docsId_fkey" FOREIGN KEY ("auditor_docsId") REFERENCES "public"."usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traslado" ADD CONSTRAINT "traslado_auditor_reqId_fkey" FOREIGN KEY ("auditor_reqId") REFERENCES "public"."usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historial_solicitud" ADD CONSTRAINT "historial_solicitud_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historial_solicitud" ADD CONSTRAINT "historial_solicitud_estatusId_fkey" FOREIGN KEY ("estatusId") REFERENCES "public"."estatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historial_solicitud" ADD CONSTRAINT "historial_solicitud_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notificaciones_correo" ADD CONSTRAINT "notificaciones_correo_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notificaciones_correo" ADD CONSTRAINT "notificaciones_correo_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "public"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notificaciones_correo" ADD CONSTRAINT "notificaciones_correo_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "public"."plantilla_correo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
