import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';

const PRIVILEGED_ROLES = [1, 2, 3, 4, 5, 6, 15];

export const GET: APIRoute = async ({ locals,  request }) => {
  const { db } = locals;
    const session = await getSession(request);

    if (!session || !session.user) {
        return new Response(JSON.stringify({ count: 0 }), { status: 401 });
    }

    const userId = parseInt(session.user.id as string, 10);
    const userRoleId = session.user.rol?.id ?? -1;
    const isResolver = PRIVILEGED_ROLES.includes(userRoleId);

    try {
        let count = 0;

        if (isResolver) {
            // Resolvers: Count NEW (2) and UNASSIGNED (1) tickets
            // Logic: Tickets assigned to them that are NEW, OR tickets that are UNASSIGNED (globally or relevant to them?)
            // The prompt says: "tickets que tengo asignados... nuevos" AND "sin asignar".
            // Let's interpret:
            // 1. Assigned to me AND Status = Nuevo (2)
            // 2. Status = Sin asignar (1) (All unassigned tickets? Or just those they can see? Usually all for resolvers)

            const assignedNewCount = await db.ticket.count({
                where: {
                    atiendeId: userId,
                    estatusId: 2, // Nuevo
                },
            });

            const unassignedCount = await db.ticket.count({
                where: {
                    estatusId: 1, // Sin asignar
                },
            });

            count = assignedNewCount + unassignedCount;

        } else {
            // Regular Users: Count UPDATED tickets (modified)
            // Logic: Tickets created by me (solicitanteId = userId) that have recent updates?
            // "tickets que se han modificado".
            // How to track "modified" status for the user?
            // Usually this implies unread notifications or tickets with recent activity not seen.
            // Since we don't have a "read" status table yet, we might approximate this or just count tickets with status changes/comments that aren't by the user.
            // For now, let's count tickets that are NOT "Nuevo" (meaning they've been touched) OR have a specific flag.
            // BUT, the prompt implies a notification count.
            // A simple approach for "modified" without a read-receipt system is hard.
            // Alternative: Count tickets in "En progreso" (updated) or "Solucionado" (completed) that haven't been "archived" or "closed" by the user?
            // Let's look at the request again: "mostrar un total de notificaciones de los tickets que se han modificado".
            // Without a "Notification" table in DB, we can't persist "unread" state.
            // However, we can count tickets where the LAST interaction was NOT by the user.
            // Let's try: Tickets requested by user where updated_at > created_at AND last_modifier != user.
            // We don't have last_modifier on Ticket easily, but we have HistorialSolicitud.

            // Let's fetch tickets requested by user
            const userTickets = await db.ticket.findMany({
                where: {
                    solicitanteId: userId,
                },
                include: {
                    historial_solicitudes: {
                        orderBy: { fecha_cambio: 'desc' },
                        take: 1,
                    }
                }
            });

            // Count tickets where the last history entry is NOT by the user
            count = userTickets.reduce((acc, ticket) => {
                const lastHistory = ticket.historial_solicitudes[0];
                if (lastHistory && lastHistory.usuarioId !== userId) {
                    return acc + 1;
                }
                return acc;
            }, 0);
        }

        return new Response(JSON.stringify({ count }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error fetching notification count:', error);
        return new Response(JSON.stringify({ count: 0 }), { status: 500 });
    }
};
