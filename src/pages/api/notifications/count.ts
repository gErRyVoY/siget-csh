import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';
import { contarTicketsConMovimientoAjeno } from '@/lib/notifications';

const PRIVILEGED_ROLES = [2, 3]; // admin y superadmin

export const GET: APIRoute = async ({ request, locals }) => {
    const session = locals.session;

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

            // Los dos conteos son independientes: van en paralelo, no en serie.
            const [assignedNewCount, unassignedCount] = await Promise.all([
                prisma.ticket.count({
                    where: {
                        atiendeId: userId,
                        estatusId: 2, // Nuevo
                    },
                }),
                prisma.ticket.count({
                    where: {
                        estatusId: 1, // Sin asignar
                    },
                }),
            ]);

            count = assignedNewCount + unassignedCount;

        } else {
            // Usuarios normales: tickets propios cuyo último movimiento no es suyo.
            // Sin tabla de acuses de lectura, «modificado» se define como «la última
            // entrada de historial la escribió otra persona». Ver src/lib/notifications.ts:
            // se resuelve en una sentencia con JOIN LATERAL en lugar de traer 100
            // tickets con siete relaciones y filtrarlos en memoria.
            count = await contarTicketsConMovimientoAjeno(userId);
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
