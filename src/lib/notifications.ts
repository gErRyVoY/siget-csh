import { prisma } from './db';

/**
 * Tickets del propio usuario cuyo último movimiento lo hizo alguien más.
 *
 * Es el criterio de «notificación» para los usuarios no privilegiados, y lo
 * consultan `/api/notifications/count` (en cada carga de página, desde
 * `MainLayout`) y `/api/notifications/list`.
 *
 * Antes se resolvía trayendo los 100 tickets más recientes del usuario con siete
 * relaciones incluidas y descartando en JavaScript los que no cumplían. Aquí se
 * resuelve en **una sentencia**: un `JOIN LATERAL` que toma sólo la última
 * entrada de historial de cada ticket, apoyado en el índice que ya existe
 * (`historial_solicitud [ticketId, fecha_cambio desc]`).
 *
 * Se conserva la ventana de los 100 tickets más recientes del comportamiento
 * anterior para no cambiar las cifras que ya ve el usuario: quien tenga más de
 * 100 tickets sigue viendo el conteo acotado a esa ventana. Quitar el techo es
 * una decisión de producto, no de rendimiento.
 */

const VENTANA = 100;

/** Cuántos tickets del usuario tienen su último movimiento hecho por otra persona. */
export async function contarTicketsConMovimientoAjeno(userId: number): Promise<number> {
  const filas = await prisma.$queryRaw<{ total: number }[]>`
    WITH recientes AS (
      SELECT id
      FROM ticket
      WHERE "solicitanteId" = ${userId}
      ORDER BY fechaact DESC
      LIMIT ${VENTANA}
    )
    SELECT count(*)::int AS total
    FROM recientes r
    JOIN LATERAL (
      SELECT h."usuarioId"
      FROM historial_solicitud h
      WHERE h."ticketId" = r.id
      ORDER BY h.fecha_cambio DESC
      LIMIT 1
    ) ultimo ON true
    WHERE ultimo."usuarioId" <> ${userId}
  `;

  return filas[0]?.total ?? 0;
}

/**
 * Ids de esos mismos tickets, del más reciente al más antiguo. El orden es el
 * mismo `fechaact desc` que usaba el `findMany` anterior.
 */
export async function idsTicketsConMovimientoAjeno(userId: number): Promise<number[]> {
  const filas = await prisma.$queryRaw<{ id: number }[]>`
    WITH recientes AS (
      SELECT id, fechaact
      FROM ticket
      WHERE "solicitanteId" = ${userId}
      ORDER BY fechaact DESC
      LIMIT ${VENTANA}
    )
    SELECT r.id
    FROM recientes r
    JOIN LATERAL (
      SELECT h."usuarioId"
      FROM historial_solicitud h
      WHERE h."ticketId" = r.id
      ORDER BY h.fecha_cambio DESC
      LIMIT 1
    ) ultimo ON true
    WHERE ultimo."usuarioId" <> ${userId}
    ORDER BY r.fechaact DESC
  `;

  return filas.map((f) => f.id);
}
