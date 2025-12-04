import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { prisma } from '@/lib/db';
import type { Prisma, Prioridad } from '@prisma/client';
import { sendNotification } from '../notifications/sse';

const PRIVILEGED_ROLES = [1, 2, 3, 4, 5, 6, 15];

export const PATCH: APIRoute = async ({ request, locals }) => {
    const session = await getSession(request);
    if (!session || !session.user) {
        return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
    }

    try {
        const data = await request.json();
        const { ticketId, newComment, newFiles, ...updateDataInput } = data;
        const currentUserId = parseInt(session.user.id as string, 10);
        const userRoleId = session.user.rol?.id ?? -1;

        if (isNaN(currentUserId)) {
            return new Response(JSON.stringify({ message: 'ID de usuario inválido en la sesión.' }), { status: 400 });
        }

        if (!ticketId || typeof ticketId !== 'number') {
            return new Response(JSON.stringify({ message: 'El ID del ticket no es válido' }), { status: 400 });
        }

        const ticketBeforeUpdate = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticketBeforeUpdate) {
            return new Response(JSON.stringify({ message: 'Ticket a actualizar no encontrado' }), { status: 404 });
        }

        // Authorization Check
        const isPrivileged = PRIVILEGED_ROLES.includes(userRoleId);
        const isOwner = ticketBeforeUpdate.solicitanteId === currentUserId;

        if (!isPrivileged && !isOwner) {
            return new Response(JSON.stringify({ message: 'No tienes permiso para modificar este ticket' }), { status: 403 });
        }

        const updateData: Prisma.TicketUpdateInput = {};
        if (updateDataInput.estatusId) updateData.estatus = { connect: { id: Number(updateDataInput.estatusId) } };
        if (updateDataInput.solicitanteId) updateData.solicitante = { connect: { id: Number(updateDataInput.solicitanteId) } };
        if (updateDataInput.atiendeId) updateData.atiende = { connect: { id: Number(updateDataInput.atiendeId) } };
        if (updateDataInput.prioridad) updateData.prioridad = updateDataInput.prioridad as Prioridad;
        if (typeof updateDataInput.archivado === 'boolean') updateData.archivado = updateDataInput.archivado;

        // Auto-set status to 'Nuevo' (2) if assignee changes and status is not explicitly provided
        if (updateDataInput.atiendeId && Number(updateDataInput.atiendeId) !== ticketBeforeUpdate.atiendeId) {
            if (!updateDataInput.estatusId) {
                updateData.estatus = { connect: { id: 2 } };
            }
        } else {
            // Auto-set status to 'En progreso' (3) if Resolver updates a 'Nuevo' ticket and didn't change status
            if (isPrivileged && ticketBeforeUpdate.estatusId === 2 && !updateDataInput.estatusId) {
                if (!updateData.estatus) {
                    updateData.estatus = { connect: { id: 3 } };
                }
            }
        }

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
                        usuarioId: currentUserId,
                        comentario: newComment || null,
                        cambios: fieldChanges.length > 0 ? { fieldChanges } : null,
                        archivos: newFiles && newFiles.length > 0 ? { newFiles } : null,
                    } as any, // Use type assertion to bypass stale types
                });

                await tx.logs.create({
                    data: {
                        accion: `Actualización de Ticket (ID: ${ticketId})`,
                        detalles: { currentUserId, comment: newComment, changes: fieldChanges, files: newFiles },
                        usuarioId: currentUserId,
                    },
                });
            }

            return ticketAfterUpdate;
        });

        // Notify users
        const notificationPayload = {
            type: 'ticket_updated' as const,
            message: `El ticket #${ticketId} ha sido actualizado`,
            ticketId: ticketId,
            originatorId: String(session.user.id)
        };

        const targetUsers: number[] = [];
        const updaterId = currentUserId;
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