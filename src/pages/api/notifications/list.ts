import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';

const PRIVILEGED_ROLES = [2, 3]; // admin y superadmin

const ticketInclude = {
    solicitante: { select: { nombres: true, apellidos: true } },
    atiende: { select: { nombres: true, apellidos: true } },
    estatus: { select: { nombre: true, id: true } },
    categoria: { select: { nombre: true } },
    subcategoria: { select: { nombre: true } },
    empresa: { select: { nombre: true } },
    traslados: { select: { id: true } }, // Solo para saber si es traslado
    historial_solicitudes: {
        orderBy: { fecha_cambio: 'desc' as const },
        take: 1,
        select: { comentario: true, usuarioId: true }
    }
};

export const GET: APIRoute = async ({ request, locals }) => {
    const session = locals.session;
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

            [totalCount, tickets] = await Promise.all([
                prisma.ticket.count({ where: whereCondition }),
                prisma.ticket.findMany({
                    where: whereCondition,
                    orderBy: { fechaact: 'desc' },
                    take: limit,
                    skip: skip,
                    include: ticketInclude,
                })
            ]);

        } else {
            // Regular Users: Tickets requested by me with updates NOT by me
            const userTickets = await prisma.ticket.findMany({
                where: { solicitanteId: userId },
                orderBy: { fechaact: 'desc' },
                take: 100,
                include: ticketInclude,
            });

            // Filter: Last history not by user
            const filteredTickets = userTickets.filter(ticket => {
                const lastHistory = ticket.historial_solicitudes[0];
                return lastHistory && lastHistory.usuarioId !== userId;
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
