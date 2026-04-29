-- =============================================================
-- Migración: add_performance_indexes
-- Fecha: 2026-04-28
-- Descripción: Añade índices en las columnas más consultadas de
--   las tablas de mayor tráfico para mejorar el rendimiento de
--   las queries principales del sistema (listado de tickets,
--   historial, notificaciones, asignación de agentes y dashboard).
-- =============================================================

-- ------------------------------------------------------------
-- Tabla: usuario
-- Optimiza: búsqueda de agentes disponibles (findBestAgentHybrid),
--           filtros de admin por empresa/rol, disponibilidad.
-- ------------------------------------------------------------

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usuario_rolId_activo_idx" ON "usuario"("rolId", "activo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usuario_empresaId_idx" ON "usuario"("empresaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usuario_activo_vacaciones_idx" ON "usuario"("activo", "vacaciones");

-- ------------------------------------------------------------
-- Tabla: logs
-- Optimiza: consultas de auditoría por usuario ordenadas por fecha.
-- ------------------------------------------------------------

-- CreateIndex
CREATE INDEX IF NOT EXISTS "logs_usuarioId_fecha_idx" ON "logs"("usuarioId", "fecha" DESC);

-- ------------------------------------------------------------
-- Tabla: ticket
-- Optimiza: listado con filtros dinámicos (solicitante, estatus,
--           agente, categoría, empresa), ordenamiento y estadísticas.
-- ------------------------------------------------------------

-- CreateIndex: filtro por solicitante (usuarios no privilegiados ven solo sus tickets)
CREATE INDEX IF NOT EXISTS "ticket_solicitanteId_idx" ON "ticket"("solicitanteId");

-- CreateIndex: filtro y groupBy por estatus (list.ts y stats.ts)
CREATE INDEX IF NOT EXISTS "ticket_estatusId_idx" ON "ticket"("estatusId");

-- CreateIndex: filtro por agente asignado (cola de trabajo del agente)
CREATE INDEX IF NOT EXISTS "ticket_atiendeId_idx" ON "ticket"("atiendeId");

-- CreateIndex: filtro por categoría
CREATE INDEX IF NOT EXISTS "ticket_categoriaId_idx" ON "ticket"("categoriaId");

-- CreateIndex: filtro por empresa/campus
CREATE INDEX IF NOT EXISTS "ticket_empresaId_idx" ON "ticket"("empresaId");

-- CreateIndex: ordenamiento descendente por fecha de alta (todas las listas)
CREATE INDEX IF NOT EXISTS "ticket_fechaalta_idx" ON "ticket"("fechaalta" DESC);

-- CreateIndex: índice compuesto para la query de lista principal con filtros simultáneos
CREATE INDEX IF NOT EXISTS "ticket_estatusId_atiendeId_archivado_idx" ON "ticket"("estatusId", "atiendeId", "archivado");

-- CreateIndex: query específica de traslados en stats.ts (subcategoria + fechaalta)
CREATE INDEX IF NOT EXISTS "ticket_subcategoriaId_fechaalta_idx" ON "ticket"("subcategoriaId", "fechaalta");

-- ------------------------------------------------------------
-- Tabla: historial_solicitud
-- Optimiza: vista de detalle del ticket (historial completo),
--           auditoría por usuario.
-- ------------------------------------------------------------

-- CreateIndex: query de historial por ticket ordenado por fecha (la más frecuente)
CREATE INDEX IF NOT EXISTS "historial_solicitud_ticketId_fecha_cambio_idx" ON "historial_solicitud"("ticketId", "fecha_cambio" DESC);

-- CreateIndex: auditoría de acciones por usuario
CREATE INDEX IF NOT EXISTS "historial_solicitud_usuarioId_idx" ON "historial_solicitud"("usuarioId");

-- ------------------------------------------------------------
-- Tabla: notificaciones_correo
-- Optimiza: relación con ticket y consultas por destinatario.
-- ------------------------------------------------------------

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notificaciones_correo_ticketId_idx" ON "notificaciones_correo"("ticketId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notificaciones_correo_destinatarioId_idx" ON "notificaciones_correo"("destinatarioId");
