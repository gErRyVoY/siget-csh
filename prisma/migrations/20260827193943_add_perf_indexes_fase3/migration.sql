-- =============================================================
-- Migración: add_perf_indexes_fase3
-- Fecha: 2026-08-27
-- Descripción: índices del punto 3.1 del plan de rendimiento. Medidos con
--   EXPLAIN ANALYZE sobre tablas de trabajo de 200 000 filas (la BD de
--   desarrollo tiene 22 tickets, ahí Postgres hace seq scan de todo y no se
--   puede medir nada). El estado de referencia de cada medición son los índices
--   que ya existen hoy, no «ningún índice».
--
--   Se escribe a mano en lugar de con `prisma migrate dev` porque el historial
--   de migraciones está desalineado con la BD (hay columnas aplicadas a mano) y
--   `migrate dev` exige resetear el esquema. Tras aplicarla, marcarla con
--   `prisma migrate resolve --applied 20260827193943_add_perf_indexes_fase3`.
--
--   En producción, si la tabla ticket ha crecido, conviene crear estos índices
--   con CREATE INDEX CONCURRENTLY (fuera de transacción) para no bloquear
--   escrituras mientras se construyen.
-- =============================================================

-- ------------------------------------------------------------
-- Tabla: traslado
-- Optimiza: /api/tickets/check-transfer, que busca por matrícula en cada alta
--   de un ticket de traslado. La columna no tenía ningún índice.
-- Medido: 2.34 ms -> 0.04 ms (60x), seq scan -> index scan.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "traslado_matricula_idx" ON "traslado"("matricula");

-- ------------------------------------------------------------
-- Tabla: ticket
-- Optimiza: la paginación de las cuatro listas, que filtran por estatus y
--   ordenan por fechaalta desc. Hoy existen los dos índices por separado y
--   Postgres recorre el de fechaalta filtrando por estatus.
-- Medido: 0.21 ms -> 0.06 ms (3.3x).
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "ticket_estatusId_fechaalta_idx" ON "ticket"("estatusId", "fechaalta" DESC);

-- ------------------------------------------------------------
-- Tabla: ticket
-- Optimiza: /api/notifications/count y /list, que filtran por solicitante y
--   ordenan por fechaact desc.
-- Medido: sin efecto (1.0x) con ~40 tickets por solicitante — ordenar 40 filas
--   en memoria es gratis — y 2.43 ms -> 0.13 ms (19x) con 4 000 tickets por
--   solicitante. Se añade por lo segundo: el endpoint corre en cada carga de
--   página y el volumen por usuario sólo crece. Contrapartida: fechaact cambia
--   en cada actualización de ticket, así que este índice se mantiene en cada
--   UPDATE. Si alguna vez pesa más de lo que aporta, es el primero a quitar.
--
--   Nota añadida el 2026-09-02: cuando se midió esto, `fechaact` no tenía
--   `@updatedAt` y ningún endpoint la escribía, así que en la práctica el índice
--   era estático y la contrapartida de arriba era teórica. Al añadirle
--   `@updatedAt` (para que las notificaciones ordenen por el último movimiento
--   real y no por la fecha de alta), el coste de mantenimiento por UPDATE pasa a
--   ser real. Sigue valiendo la pena, pero es el dato que faltaba.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "ticket_solicitanteId_fechaact_idx" ON "ticket"("solicitanteId", "fechaact" DESC);

-- ------------------------------------------------------------
-- Tabla: incidencia
-- Optimiza: /api/user/incidencias, que filtra por usuario y mes. El compuesto
--   cubre también las consultas que sólo filtran por usuario (prefijo
--   izquierdo), así que sustituye al índice simple en vez de sumarse a él.
-- Medido: 0.15 ms -> 0.04 ms (3.8x) frente al índice simple actual.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "incidencia_usuarioId_mes_idx" ON "incidencia"("usuarioId", "mes");
DROP INDEX IF EXISTS "incidencia_usuarioId_idx";
