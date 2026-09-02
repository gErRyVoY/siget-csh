/**
 * Límites de longitud de los campos de `ticket`, espejo de `prisma/schema.prisma`.
 *
 * Existen para poder responder 400 con un mensaje útil antes de llegar a Postgres.
 * Sin ellos, un valor demasiado largo llega al `INSERT`, Prisma lo rechaza con
 * `P2000` y el endpoint devuelve 500 «Error interno del servidor» — que no le dice
 * nada a quien está llenando el formulario y obliga a leer el log del servidor.
 *
 * Si cambia el `@db.VarChar(n)` del esquema, hay que cambiar el número de aquí.
 */

/** `Ticket.afectado_clave` — matrícula, folio, email institucional o clave. */
export const MAX_AFECTADO_CLAVE = 255;

/** `Ticket.afectado_nombre` — nombre completo del afectado. */
export const MAX_AFECTADO_NOMBRE = 150;
