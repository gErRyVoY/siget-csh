-- CreateTable
CREATE TABLE "empresa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "rol" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rol" TEXT NOT NULL,
    "descripcion" TEXT,
    "nivel_soporte" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "atiendeTicketsCsh" BOOLEAN NOT NULL DEFAULT false,
    "atiendeTicketsMkt" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "oferta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descripcion" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "carrera" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clave" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "ofertaId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "carrera_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "oferta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mail" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "alias" TEXT,
    "image" TEXT,
    "empresaId" INTEGER NOT NULL,
    "rolId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vacaciones" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_login" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horario_disponibilidad" TEXT,
    "carga_actual" INTEGER NOT NULL DEFAULT 0,
    "auditor_docs" BOOLEAN NOT NULL DEFAULT false,
    "auditor_req" BOOLEAN NOT NULL DEFAULT false,
    "trl_mail" BOOLEAN NOT NULL DEFAULT false,
    "trl_coord" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "rol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accion" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalles" TEXT,
    "usuarioId" INTEGER NOT NULL,
    CONSTRAINT "logs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ciclo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ciclo" TEXT NOT NULL,
    "fecha_inicio" DATETIME NOT NULL,
    "fecha_fin" DATETIME NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "bloque" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clave" TEXT NOT NULL,
    "grado" TEXT NOT NULL,
    "carreraId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "dias" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "campusId" INTEGER NOT NULL,
    CONSTRAINT "bloque_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "carrera" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bloque_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "ciclo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bloque_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "descuento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descripcion" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "estatus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "nivel_soporte_requerido" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "subcategoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "parent_subcategoriaId" INTEGER,
    "nivel_soporte_requerido" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "subcategoria_parent_subcategoriaId_fkey" FOREIGN KEY ("parent_subcategoriaId") REFERENCES "subcategoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subcategoria_categorias" (
    "categoriaId" INTEGER NOT NULL,
    "subcategoriaId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY ("categoriaId", "subcategoriaId"),
    CONSTRAINT "subcategoria_categorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "subcategoria_categorias_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "subcategoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asignaciones_categorias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "atiendeId" INTEGER NOT NULL,
    "categoriaId" INTEGER,
    "subcategoriaId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "prioridad" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "asignaciones_categorias_atiendeId_fkey" FOREIGN KEY ("atiendeId") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_categorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categoria" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_categorias_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "subcategoria" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ticket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fechaalta" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaact" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estatusId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "subcategoriaId" INTEGER,
    "solicitanteId" INTEGER NOT NULL,
    "atiendeId" INTEGER,
    "prioridad" TEXT NOT NULL,
    "descripcion" TEXT,
    "afectado_clave" TEXT,
    "afectado_nombre" TEXT,
    "empresaId" INTEGER NOT NULL,
    "cicloId" INTEGER,
    "archivado" BOOLEAN NOT NULL DEFAULT false,
    "archivos" TEXT,
    CONSTRAINT "ticket_estatusId_fkey" FOREIGN KEY ("estatusId") REFERENCES "estatus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ticket_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ticket_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "subcategoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ticket_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ticket_atiendeId_fkey" FOREIGN KEY ("atiendeId") REFERENCES "usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ticket_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ticket_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "ciclo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "plan_pago" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "traslado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketId" INTEGER NOT NULL,
    "folio" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "alumno" TEXT NOT NULL,
    "origenId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "carreraId" INTEGER NOT NULL,
    "descuentoId" INTEGER NOT NULL,
    "bloqueId" INTEGER,
    "bloque_nombre" TEXT,
    "actualizacion" BOOLEAN NOT NULL DEFAULT false,
    "planpagoId" INTEGER,
    "auditor_docsId" INTEGER,
    "auditor_reqId" INTEGER,
    "especial" BOOLEAN NOT NULL DEFAULT false,
    "nuevo_ingreso" BOOLEAN NOT NULL DEFAULT false,
    "mail" TEXT,
    "mail_escuela" TEXT,
    "telefono" TEXT,
    "tel_movil" TEXT,
    "validacion_docs" BOOLEAN NOT NULL DEFAULT false,
    "descripcion_docs" TEXT,
    "validacion_calif" BOOLEAN NOT NULL DEFAULT false,
    "descripcion_calif" TEXT,
    "validacion_edocta" BOOLEAN NOT NULL DEFAULT false,
    "descripcion_edocta" TEXT,
    CONSTRAINT "traslado_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "traslado_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "traslado_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "traslado_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "carrera" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "traslado_descuentoId_fkey" FOREIGN KEY ("descuentoId") REFERENCES "descuento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "traslado_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "bloque" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "traslado_planpagoId_fkey" FOREIGN KEY ("planpagoId") REFERENCES "plan_pago" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "traslado_auditor_docsId_fkey" FOREIGN KEY ("auditor_docsId") REFERENCES "usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "traslado_auditor_reqId_fkey" FOREIGN KEY ("auditor_reqId") REFERENCES "usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "historial_solicitud" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketId" INTEGER NOT NULL,
    "estatusId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fecha_cambio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,
    "cambios" TEXT,
    "archivos" TEXT,
    CONSTRAINT "historial_solicitud_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "historial_solicitud_estatusId_fkey" FOREIGN KEY ("estatusId") REFERENCES "estatus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "historial_solicitud_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "plantilla_correo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "contenido" TEXT,
    "tipo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "notificaciones_correo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketId" INTEGER NOT NULL,
    "destinatarioId" INTEGER NOT NULL,
    "fecha_envio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plantillaId" INTEGER NOT NULL,
    "estatus" TEXT NOT NULL,
    "mensaje_error" TEXT,
    CONSTRAINT "notificaciones_correo_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notificaciones_correo_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notificaciones_correo_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantilla_correo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "permiso" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT
);

-- CreateTable
CREATE TABLE "permiso_categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rolId" INTEGER NOT NULL,
    "categoriaId" INTEGER,
    "subcategoriaId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "permiso_categoria_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "rol" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "permiso_categoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categoria" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "permiso_categoria_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "subcategoria" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "seccion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "grupo" TEXT,
    "subgrupo" TEXT,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "permiso_rol_seccion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rolId" INTEGER NOT NULL,
    "seccionId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "permiso_rol_seccion_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "rol" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "permiso_rol_seccion_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "seccion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "permiso_usuario_seccion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER NOT NULL,
    "seccionId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "permiso_usuario_seccion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "permiso_usuario_seccion_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "seccion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_PermisoToRol" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_PermisoToRol_A_fkey" FOREIGN KEY ("A") REFERENCES "permiso" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_PermisoToRol_B_fkey" FOREIGN KEY ("B") REFERENCES "rol" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_slug_key" ON "empresa"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_mail_key" ON "usuario"("mail");

-- CreateIndex
CREATE UNIQUE INDEX "bloque_clave_key" ON "bloque"("clave");

-- CreateIndex
CREATE INDEX "asignaciones_categorias_categoriaId_subcategoriaId_activo_idx" ON "asignaciones_categorias"("categoriaId", "subcategoriaId", "activo");

-- CreateIndex
CREATE INDEX "asignaciones_categorias_atiendeId_activo_idx" ON "asignaciones_categorias"("atiendeId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_categorias_atiendeId_categoriaId_subcategoriaId_key" ON "asignaciones_categorias"("atiendeId", "categoriaId", "subcategoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "traslado_ticketId_key" ON "traslado"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "traslado_folio_key" ON "traslado"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_nombre_key" ON "permiso"("nombre");

-- CreateIndex
CREATE INDEX "permiso_categoria_categoriaId_subcategoriaId_activo_idx" ON "permiso_categoria"("categoriaId", "subcategoriaId", "activo");

-- CreateIndex
CREATE INDEX "permiso_categoria_rolId_activo_idx" ON "permiso_categoria"("rolId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_categoria_rolId_categoriaId_subcategoriaId_key" ON "permiso_categoria"("rolId", "categoriaId", "subcategoriaId");

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

-- CreateIndex
CREATE UNIQUE INDEX "_PermisoToRol_AB_unique" ON "_PermisoToRol"("A", "B");

-- CreateIndex
CREATE INDEX "_PermisoToRol_B_index" ON "_PermisoToRol"("B");
