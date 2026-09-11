/**
 * Identificadores de categoría con significado especial para la aplicación.
 *
 * Marketing es la única categoría que tiene su propio circuito completo —vista de
 * alta, listas, dashboard y agentes propios— separado del de soporte (CSH). Eso
 * obliga a decidir en cada consulta de tickets si se incluye o se excluye, y el
 * valor estaba repetido en once archivos (`src/services/ticketAssignmentService.ts`,
 * las cuatro listas, los dos dashboards, el detalle de ticket y las dos vistas de
 * alta), con el riesgo de que un cambio de id dejara la mitad del sistema
 * mirando a la categoría equivocada.
 */

/** Categoría `Marketing` (fila 12 de `categoria`). */
export const MARKETING_CATEGORY_ID = 12;

/** Sección que habilita el alta de tickets de marketing. */
export const MARKETING_CREATE_SECTION = "crear_ticket_marketing";

/** Sección que habilita el alta de tickets de soporte (CSH). */
export const CSH_CREATE_SECTION = "crear_ticket_csh";

/** `true` si la categoría pertenece al circuito de marketing. */
export function isMarketingCategory(categoriaId: number | null | undefined): boolean {
    return categoriaId === MARKETING_CATEGORY_ID;
}
