-- =============================================================
-- Migración: add_configuracion_traslados
-- Fecha: 2026-09-12
-- Descripción: tabla `configuracion_traslados` (una sola fila) + la sección
--              «Administrador > SiGeT > Traslados» que la administra.
--
--   Contexto: hasta ahora la vista `/tickets/soporte/traslado` sólo se podía
--   ocultar a mano desde `/admin/secciones`, y el ciclo del traslado era el
--   ciclo activo. La nueva vista `/admin/traslados` programa el periodo:
--
--     * fecha_inicio_traslados / fecha_fin_traslados — ventana en la que la
--       sección `proceso_traslados` es visible para todos los campus. Fuera de
--       ella el `jwt` callback la quita de `token.secciones`, así que
--       desaparecen a la vez el enlace del sidebar y el acceso a la ruta.
--     * fecha_fin_trl_virtual — fecha intermedia tras la cual Campus Virtual
--       deja de admitirse como campus destino.
--     * cicloId — ciclo al que pertenecen los traslados del periodo. NULL
--       significa «automático»: el ciclo siguiente al activo en `/admin/ciclos`
--       (si el activo es 2027-1, los traslados son para 2027-2).
--
--   Por qué una tabla y no columnas en otra: no existe ninguna tabla de
--   configuración genérica en el esquema, y `traslado` no tiene columna de
--   ciclo (el ciclo de un traslado es `ticket.cicloId`).
--
--   Por qué una sola fila: la configuración es global, no por campus. La fila
--   la crea esta migración con las tres fechas en NULL, de modo que **por
--   defecto los traslados quedan ocultos para todos**. `/admin/traslados` sólo
--   hace UPDATE sobre ella; nunca INSERT ni DELETE.
--
--   Coste de aplicarla: CREATE TABLE sobre una tabla vacía y tres INSERT de una
--   fila. No toca ninguna tabla existente salvo para añadir una sección y su
--   permiso de rol. Sin locks relevantes ni ventana de mantenimiento.
--
--   Se escribe a mano, no con `prisma migrate dev`, porque la única base de
--   datos del proyecto es producción. Se aplica con
--   `prisma db execute --file prisma/migrations/20260912183000_add_configuracion_traslados/migration.sql --schema prisma/schema.prisma`
--   y se marca con
--   `prisma migrate resolve --applied 20260912183000_add_configuracion_traslados`.
-- =============================================================

-- Cada sentencia es idempotente a propósito: al aplicarse a mano sobre
-- producción, si algo falla a mitad se puede volver a ejecutar el archivo entero
-- sin dejar filas duplicadas. La FK va en línea en el CREATE TABLE (y no en un
-- ALTER aparte, como haría `prisma migrate dev`) justamente para que el
-- IF NOT EXISTS la cubra.
--
-- SET NULL y no CASCADE en la FK: si se borra un ciclo, la configuración debe
-- volver al modo automático, no desaparecer.
CREATE TABLE IF NOT EXISTS "configuracion_traslados" (
    "id"                     SERIAL       NOT NULL,
    "fecha_inicio_traslados" TIMESTAMP(6),
    "fecha_fin_traslados"    TIMESTAMP(6),
    "fecha_fin_trl_virtual"  TIMESTAMP(6),
    "cicloId"                INTEGER,
    "actualizado_porId"      INTEGER,
    "updatedAt"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_traslados_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "configuracion_traslados_cicloId_fkey"
        FOREIGN KEY ("cicloId") REFERENCES "ciclo"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Fila única, todo en NULL: traslados ocultos hasta que un superadmin programe
-- el periodo.
INSERT INTO "configuracion_traslados" ("updatedAt")
SELECT NOW()
WHERE NOT EXISTS (SELECT 1 FROM "configuracion_traslados");

-- Sección del sidebar «Administrador > SiGeT > Traslados» (/admin/traslados).
-- Los ids 19 y 21 están retirados y no se reutilizan: el siguiente libre es 24.
-- `ON CONFLICT DO NOTHING` sin columnas cubre tanto la PK como el único de
-- `identificador`.
INSERT INTO "seccion" ("id", "nombre", "identificador", "grupo", "subgrupo", "descripcion", "activo")
VALUES (
    24,
    'Traslados',
    'admin_siget_traslados',
    'Administrador',
    'SiGeT',
    'Programa el periodo de traslados, la fecha límite de Campus Virtual y el ciclo destino',
    true
)
ON CONFLICT DO NOTHING;

-- `seccion.id` es SERIAL y tanto el seed como la sentencia anterior insertan ids
-- explícitos, así que la secuencia puede haber quedado por detrás. Se realinea
-- para que un futuro INSERT sin id no choque con la clave primaria. Va dentro de
-- un DO/PERFORM para no devolver filas: `prisma db execute` descarta resultados,
-- pero así el script no depende de ese detalle.
DO $$
BEGIN
    PERFORM setval(pg_get_serial_sequence('seccion', 'id'), (SELECT MAX("id") FROM "seccion"));
END
$$;

-- Sólo Superadmin (rolId 3) la recibe, igual que el resto del grupo SiGeT.
INSERT INTO "permiso_rol_seccion" ("rolId", "seccionId", "activo", "createdAt", "updatedAt")
SELECT 3, s."id", true, NOW(), NOW()
FROM "seccion" s
WHERE s."identificador" = 'admin_siget_traslados'
ON CONFLICT ("rolId", "seccionId") DO NOTHING;
