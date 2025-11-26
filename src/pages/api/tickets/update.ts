import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { prisma } from '@/lib/db';
import type { Prisma, Prioridad } from '@prisma/client';
import { sendNotification } from '../notifications';

const PRIVILEGED_ROLES = [1, 2, 3, 4, 5, 6, 15];

export const PATCH: APIRoute = async ({ request, locals }) => {
    const session = await getSession(request);
    if (!session || !session.user || !PRIVILEGED_ROLES.includes(session.user.rol?.id ?? -1)) {
        return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 403 });
    }

    try {
        const data = await request.json();
        const { ticketId, newComment, newFiles, ...updateDataInput } = data;
        const adminUserId = parseInt(session.user.id as string, 10);

        if (isNaN(adminUserId)) {
            return new Response(JSON.stringify({ message: 'ID de administrador inválido en la sesión.' }), { status: 400 });
        }

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

        if (Array.isArray(newFiles) && newFiles.length > 0) {
            const existingArchivos = (ticketBeforeUpdate as any).archivos || [];
            (updateData as any).archivos = [...existingArchivos, ...newFiles];
        }

        const updatedTicket = await prisma.$transaction(async (tx) => {
            const ticketAfterUpdate = await tx.ticket.update({
                where: { id: ticketId },
                data: updateData,
            });

            const fieldChanges: { field: string, oldValue: any, newValue: any }[] = [];

            // Explicitly check for changes in tracked fields
            if (ticketBeforeUpdate.estatusId !== ticketAfterUpdate.estatusId) {
                fieldChanges.push({ field: 'estatusId', oldValue: ticketBeforeUpdate.estatusId, newValue: ticketAfterUpdate.estatusId });
            }
            if (ticketBeforeUpdate.prioridad !== ticketAfterUpdate.prioridad) {
                fieldChanges.push({ field: 'prioridad', oldValue: ticketBeforeUpdate.prioridad, newValue: ticketAfterUpdate.prioridad });
            }
            if (ticketBeforeUpdate.atiendeId !== ticketAfterUpdate.atiendeId) {
                fieldChanges.push({ field: 'atiendeId', oldValue: ticketBeforeUpdate.atiendeId, newValue: ticketAfterUpdate.atiendeId });
            }
            if (ticketBeforeUpdate.archivado !== ticketAfterUpdate.archivado) {
                fieldChanges.push({ field: 'archivado', oldValue: ticketBeforeUpdate.archivado, newValue: ticketAfterUpdate.archivado });
            }

            if (fieldChanges.length > 0 || newComment || (newFiles && newFiles.length > 0)) {
                await tx.historialSolicitud.create({
                    data: {
                        ticketId: ticketId,
                        estatusId: ticketAfterUpdate.estatusId,
                        usuarioId: adminUserId,
                        comentario: newComment || null,
                        cambios: fieldChanges.length > 0 ? { fieldChanges } : null,
                        archivos: newFiles && newFiles.length > 0 ? { newFiles } : null,
                    } as any, // Use type assertion to bypass stale types
                });

                await tx.logs.create({
                    data: {
                        accion: `Actualización de Ticket (ID: ${ticketId})`,
                        detalles: { adminUserId, comment: newComment, changes: fieldChanges, files: newFiles },
                        usuarioId: adminUserId,
                    },
                });
            }

            return ticketAfterUpdate;
        });

        // Notify users
        const notificationPayload: any = {
            type: 'ticket_updated',
            message: `El ticket #${ticketId} ha sido actualizado`,
            ticketId: ticketId,
            originatorId: String(session.user.id)
        };

        const targetUsers: number[] = [];
        const updaterId = adminUserId;
        const solicitanteId = ticketBeforeUpdate.solicitanteId;
        const atiendeId = updatedTicket.atiendeId;

        // Logic to determine who to notify
        if (updaterId !== solicitanteId) {
            targetUsers.push(solicitanteId);
        }
        if (atiendeId && updaterId !== atiendeId) {
            targetUsers.push(atiendeId);
        }

        sendNotification(notificationPayload, targetUsers);

        return new Response(JSON.stringify(updatedTicket), { status: 200 });

    } catch (error: any) {
        console.error('Error updating ticket:', error.message, error.stack);
        return new Response(JSON.stringify({ message: 'Error interno del servidor', error: error.message }), { status: 500 });
    }
};