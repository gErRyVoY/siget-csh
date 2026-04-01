import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { prisma } from '@/lib/db';

const PRIVILEGED_ROLES = [1, 2, 3, 4, 5, 6, 15];

export const GET: APIRoute = async ({ request }) => {
    const session = await getSession(request);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);
    const skip = (page - 1) * limit;

    if (!session || !session.user) {
        return new Response(JSON.stringify({ tickets: [], hasMore: false }), { status: 401 });
    }

    const userId = parseInt(session.user.id as string, 10);
    const userRoleId = session.user.rol?.id ?? -1;
    const isResolver = PRIVILEGED_ROLES.includes(userRoleId);

    try {
        let tickets: any[] = [];
        let totalCount = 0;

        if (isResolver) {
            // Resolvers: NEW (2) assigned to me OR UNASSIGNED (1)
            const whereCondition = {
                OR: [
                    { atiendeId: userId, estatusId: 2 }, // Nuevo y asignado a mí
                    { estatusId: 1 } // Sin asignar (cualquiera)
                ]
            };

            // Get total count for pagination check
            totalCount = await prisma.ticket.count({ where: whereCondition });

            // Get paginated items
            tickets = await prisma.ticket.findMany({
                where: whereCondition,
                orderBy: { fechaact: 'desc' }, // Most recent first
                take: limit,
                skip: skip,
                include: {
                    solicitante: { select: { nombres: true, apellidos: true } },
                    estatus: { select: { nombre: true, id: true } },
                    categoria: { select: { nombre: true } },
                    historial_solicitudes: {
                        orderBy: { fecha_cambio: 'desc' },
                        take: 1,
                        select: { comentario: true }
                    }
                }
            });

        } else {
            // Regular Users: Tickets requested by me with updates NOT by me
            // Since we can't easily filter this in Prisma level efficiently without raw query or complex joins,
            // and we need pagination, this is tricky.
            // Strategy: Fetch a larger chunk of user's tickets, filter in memory, then slice.
            // Warning: Pagination might be inexact if we filter in memory.
            // Better approach for now: Fetch user tickets ordered by update time, filter, then slice.

            const userTickets = await prisma.ticket.findMany({
                where: { solicitanteId: userId },
                orderBy: { fechaact: 'desc' },
                include: {
                    historial_solicitudes: {
                        orderBy: { fecha_cambio: 'desc' },
                        take: 1,
                    },
                    estatus: { select: { nombre: true, id: true } },
                    categoria: { select: { nombre: true } },
                    solicitante: { select: { nombres: true, apellidos: true } }
                }
            });

            // Filter: Last history not by user
            const filteredTickets = userTickets.filter(ticket => {
                const lastHistory = ticket.historial_solicitudes[0];
                const isNotByUser = lastHistory && lastHistory.usuarioId !== userId;

                console.log(`[Debug List] Ticket ${ticket.id}: LastHistoryUser=${lastHistory?.usuarioId}, CurrentUser=${userId}, Keep=${isNotByUser}`);

                // If there is history and the last one is NOT by the current user, it's a notification
                return isNotByUser;
            });

            totalCount = filteredTickets.length;
            tickets = filteredTickets.slice(skip, skip + limit);
        }

        return new Response(JSON.stringify({
            tickets,
            hasMore: skip + limit < totalCount
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error fetching notification list:', error);
        return new Response(JSON.stringify({ tickets: [], hasMore: false }), { status: 500 });
    }
};
