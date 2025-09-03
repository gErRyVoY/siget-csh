import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { prisma } from '@/lib/db';
import type { Prisma, Prioridad } from '@prisma/client';

const PRIVILEGED_ROLES = [1, 2, 3, 4, 5, 6, 15];

export const PATCH: APIRoute = async ({ request }) => {
    const session = await getSession(request);
    if (!session || !session.user || !PRIVILEGED_ROLES.includes(session.user.rol?.id ?? -1)) {
        return new Response(JSON.stringify({ message: 'No autorizado para realizar esta acción' }), { status: 403 });
    }

    try {
        const data = await request.json();
        const { ticketId, ...updateDataInput } = data;
        const adminUserId = session.user.id;

        if (!ticketId || typeof ticketId !== 'number') {
            return new Response(JSON.stringify({ message: 'El ID del ticket no es válido' }), { status: 400 });
        }

        const ticketBeforeUpdate = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticketBeforeUpdate) {
            return new Response(JSON.stringify({ message: 'Ticket a actualizar no encontrado' }), { status: 404 });
        }

        const updateData: Prisma.TicketUpdateInput = {};

        if (updateDataInput.estatusId) updateData.estatus = { connect: { id: Number(updateDataInput.estatusId) } };
        if (updateDataInput.solicitanteId) updateData.solicitante = { connect: { id: Number(updateDataInput.solicitanteId) } };
        if (updateDataInput.atiendeId) updateData.atiende = { connect: { id: Number(updateDataInput.atiendeId) } };
        if (updateDataInput.prioridad) updateData.prioridad = updateDataInput.prioridad as Prioridad;
        if (typeof updateDataInput.archivado === 'boolean') updateData.archivado = updateDataInput.archivado;

        // Use a transaction to update and log changes
        const updatedTicket = await prisma.$transaction(async (tx) => {
            const ticketAfterUpdate = await tx.ticket.update({
                where: { id: ticketId },
                data: updateData,
            });

            const changes: { field: string, oldValue: any, newValue: any }[] = [];
            for (const key of Object.keys(updateData)) {
                const oldValue = (ticketBeforeUpdate as any)[key];
                const newValue = (ticketAfterUpdate as any)[key];
                if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                    changes.push({ field: key, oldValue, newValue });
                }
            }

            if (changes.length > 0) {
                // Create a general log entry
                await tx.logs.create({
                    data: {
                        accion: `Actualización de Ticket (ID: ${ticketId})`,
                        detalles: { adminUserId, changes },
                        usuarioId: adminUserId,
                    },
                });

                // Create a specific history entry for the ticket
                await tx.historialSolicitud.create({
                    data: {
                        ticketId: ticketId,
                        estatusId: ticketAfterUpdate.estatusId,
                        usuarioId: adminUserId,
                        comentario: { changes },
                    }
                });
            }

            return ticketAfterUpdate;
        });

        return new Response(JSON.stringify(updatedTicket), { status: 200 });

    } catch (error) {
        console.error('Error updating ticket:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
    }
};
