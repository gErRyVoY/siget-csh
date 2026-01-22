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
        const { ticketId, newComment, newFiles, afectado_clave, afectado_nombre, descripcion, ...updateDataInput } = data;
        const currentUserId = parseInt(session.user.id as string, 10);
        const userRoleId = session.user.rol?.id ?? -1;

        if (isNaN(currentUserId)) {
            return new Response(JSON.stringify({ message: 'ID de usuario inválido en la sesión.' }), { status: 400 });
        }

        if (!ticketId || typeof ticketId !== 'number') {
            return new Response(JSON.stringify({ message: 'El ID del ticket no es válido' }), { status: 400 });
        }

        const ticketBeforeUpdate = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: { estatus: true, atiende: true }
        });
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

        if (typeof afectado_clave === 'string') updateData.afectado_clave = afectado_clave;
        if (typeof afectado_nombre === 'string') updateData.afectado_nombre = afectado_nombre;
        if (typeof descripcion === 'string') updateData.descripcion = descripcion;

        // --- Traslado Logic ---
        const ticketWithTraslado = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: { traslados: true }
        });

        // Fields specific to Traslado
        const {
            matricula,
            alumno,
            origenId,
            destinoId,
            carreraId,
            nuevo_ingreso,
            bloque_nombre,
            bloqueId,
            descuentoId,
            auditor_docsId,
            auditor_reqId,
            validacion_docs,
            descripcion_docs,
            validacion_edocta,
            descripcion_edocta,
            validacion_calif,
            descripcion_calif
        } = updateDataInput;

        let trasladoUpdateData: any = {};
        if (matricula) trasladoUpdateData.matricula = matricula;
        if (alumno) trasladoUpdateData.alumno = alumno;
        if (origenId) trasladoUpdateData.origenId = Number(origenId);
        if (destinoId) trasladoUpdateData.destinoId = Number(destinoId);
        if (carreraId) trasladoUpdateData.carreraId = Number(carreraId);
        if (typeof nuevo_ingreso === 'boolean') trasladoUpdateData.nuevo_ingreso = nuevo_ingreso;
        if (bloque_nombre) trasladoUpdateData.bloque_nombre = bloque_nombre;
        if (bloqueId) trasladoUpdateData.bloqueId = bloqueId === 'null' ? null : Number(bloqueId); // Handle null
        if (descuentoId) trasladoUpdateData.descuentoId = Number(descuentoId);

        // Auditors & Validations
        if (auditor_docsId !== undefined) trasladoUpdateData.auditor_docsId = auditor_docsId ? Number(auditor_docsId) : null;
        if (auditor_reqId !== undefined) trasladoUpdateData.auditor_reqId = auditor_reqId ? Number(auditor_reqId) : null;

        if (typeof validacion_docs === 'boolean') trasladoUpdateData.validacion_docs = validacion_docs;
        if (descripcion_docs) trasladoUpdateData.descripcion_docs = descripcion_docs;

        if (typeof validacion_edocta === 'boolean') trasladoUpdateData.validacion_edocta = validacion_edocta;
        if (descripcion_edocta) trasladoUpdateData.descripcion_edocta = descripcion_edocta;

        if (typeof validacion_calif === 'boolean') trasladoUpdateData.validacion_calif = validacion_calif;
        if (descripcion_calif) trasladoUpdateData.descripcion_calif = descripcion_calif;


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
                include: { estatus: true, atiende: true }
            });

            if (ticketWithTraslado?.traslados?.[0] && Object.keys(trasladoUpdateData).length > 0) {
                await tx.traslado.update({
                    where: { id: ticketWithTraslado.traslados[0].id },
                    data: trasladoUpdateData
                });
                // We could track changes for transfer fields here too if we wanted detailed logs
            }

            const fieldChanges: { field: string, oldValue: any, newValue: any }[] = [];

            // Explicitly check for changes in tracked fields
            if (ticketBeforeUpdate.estatusId !== ticketAfterUpdate.estatusId) {
                fieldChanges.push({ field: 'estatusId', oldValue: ticketBeforeUpdate.estatus?.nombre, newValue: ticketAfterUpdate.estatus?.nombre });
            }
            if (ticketBeforeUpdate.prioridad !== ticketAfterUpdate.prioridad) {
                fieldChanges.push({ field: 'prioridad', oldValue: ticketBeforeUpdate.prioridad, newValue: ticketAfterUpdate.prioridad });
            }
            if (ticketBeforeUpdate.atiendeId !== ticketAfterUpdate.atiendeId) {
                const oldAgent = ticketBeforeUpdate.atiende ? `${ticketBeforeUpdate.atiende.nombres} ${ticketBeforeUpdate.atiende.apellidos}` : 'Sin asignar';
                const newAgent = ticketAfterUpdate.atiende ? `${ticketAfterUpdate.atiende.nombres} ${ticketAfterUpdate.atiende.apellidos}` : 'Sin asignar';
                fieldChanges.push({ field: 'atiendeId', oldValue: oldAgent, newValue: newAgent });
            }
            if (ticketBeforeUpdate.archivado !== ticketAfterUpdate.archivado) {
                fieldChanges.push({ field: 'archivado', oldValue: ticketBeforeUpdate.archivado, newValue: ticketAfterUpdate.archivado });
            }
            if (ticketBeforeUpdate.afectado_clave !== ticketAfterUpdate.afectado_clave) {
                fieldChanges.push({ field: 'afectado_clave', oldValue: ticketBeforeUpdate.afectado_clave, newValue: ticketAfterUpdate.afectado_clave });
            }
            if (ticketBeforeUpdate.afectado_nombre !== ticketAfterUpdate.afectado_nombre) {
                fieldChanges.push({ field: 'afectado_nombre', oldValue: ticketBeforeUpdate.afectado_nombre, newValue: ticketAfterUpdate.afectado_nombre });
            }
            if (ticketBeforeUpdate.descripcion !== ticketAfterUpdate.descripcion) {
                fieldChanges.push({ field: 'descripcion', oldValue: ticketBeforeUpdate.descripcion, newValue: ticketAfterUpdate.descripcion });
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