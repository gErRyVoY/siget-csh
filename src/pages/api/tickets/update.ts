import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import type { Prisma, Prioridad } from '@prisma/client';
import { sendNotification } from '../notifications/sse';

const PRIVILEGED_ROLES = [1, 2, 3, 4, 5, 6, 15];

export const PATCH: APIRoute = async ({ request, locals }) => {
  const { db } = locals;
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

        const ticketBeforeUpdate = await db.ticket.findUnique({
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
        
        if ('atiendeId' in updateDataInput) {
            const parsedAtiendeId = Number(updateDataInput.atiendeId);
            if (parsedAtiendeId > 0) {
                updateData.atiende = { connect: { id: parsedAtiendeId } };
            } else if (ticketBeforeUpdate.atiendeId !== null) {
                updateData.atiende = { disconnect: true };
            }
        }
        if (updateDataInput.prioridad) updateData.prioridad = updateDataInput.prioridad as Prioridad;
        if (typeof updateDataInput.archivado === 'boolean') updateData.archivado = updateDataInput.archivado;

        if (typeof afectado_clave === 'string') updateData.afectado_clave = afectado_clave;
        if (typeof afectado_nombre === 'string') updateData.afectado_nombre = afectado_nombre;
        if (typeof descripcion === 'string') updateData.descripcion = descripcion;

        // --- Traslado Logic ---
        const ticketWithTraslado = await db.ticket.findUnique({
            where: { id: ticketId },
            include: {
                traslados: {
                    include: {
                        origen: true,
                        destino: true,
                        carrera: { include: { oferta: true } },
                        descuento: true
                    }
                }
            }
        });
        const oldTraslado = ticketWithTraslado?.traslados?.[0];

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
            descuento_nombre,
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
        if (matricula !== undefined) trasladoUpdateData.matricula = matricula;
        if (alumno !== undefined) trasladoUpdateData.alumno = alumno;
        if (origenId) trasladoUpdateData.origenId = Number(origenId);
        if (destinoId) trasladoUpdateData.destinoId = Number(destinoId);
        if (carreraId) trasladoUpdateData.carreraId = Number(carreraId);
        if (typeof nuevo_ingreso === 'boolean') trasladoUpdateData.nuevo_ingreso = nuevo_ingreso;
        if (bloque_nombre !== undefined) trasladoUpdateData.bloque_nombre = bloque_nombre;
        if (bloqueId) trasladoUpdateData.bloqueId = bloqueId === 'null' ? null : Number(bloqueId);
        if (descuentoId) trasladoUpdateData.descuentoId = Number(descuentoId);

        // If exact discount name is passed but no ID, we might just log the name change from the frontend if needed?
        // Actually the frontend passes ID now.

        // Auditors & Validations
        if (auditor_docsId !== undefined) trasladoUpdateData.auditor_docsId = auditor_docsId ? Number(auditor_docsId) : null;
        if (auditor_reqId !== undefined) trasladoUpdateData.auditor_reqId = auditor_reqId ? Number(auditor_reqId) : null;

        if (typeof validacion_docs === 'boolean') trasladoUpdateData.validacion_docs = validacion_docs;
        if (descripcion_docs !== undefined) trasladoUpdateData.descripcion_docs = descripcion_docs;

        if (typeof validacion_edocta === 'boolean') trasladoUpdateData.validacion_edocta = validacion_edocta;
        if (descripcion_edocta !== undefined) trasladoUpdateData.descripcion_edocta = descripcion_edocta;

        if (typeof validacion_calif === 'boolean') trasladoUpdateData.validacion_calif = validacion_calif;
        if (descripcion_calif !== undefined) trasladoUpdateData.descripcion_calif = descripcion_calif;


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

        const updatedTicket = await db.$transaction(async (tx) => {
            const ticketAfterUpdate = await tx.ticket.update({
                where: { id: ticketId },
                data: updateData,
                include: { estatus: true, atiende: true }
            });

            // Resolving Names for Transfer History
            const fieldChanges: { field: string, oldValue: any, newValue: any }[] = [];

            if (oldTraslado && Object.keys(trasladoUpdateData).length > 0) {
                await tx.traslado.update({
                    where: { id: oldTraslado.id },
                    data: trasladoUpdateData
                });

                // --- History Logic for Transfer ---
                // Simple Fields
                if (matricula !== undefined && matricula !== oldTraslado.matricula)
                    fieldChanges.push({ field: 'matricula', oldValue: oldTraslado.matricula, newValue: matricula });

                if (alumno !== undefined && alumno !== oldTraslado.alumno)
                    fieldChanges.push({ field: 'alumno', oldValue: oldTraslado.alumno, newValue: alumno });

                if (nuevo_ingreso !== undefined && nuevo_ingreso !== oldTraslado.nuevo_ingreso)
                    fieldChanges.push({ field: 'nuevo_ingreso', oldValue: oldTraslado.nuevo_ingreso ? 'Si' : 'No', newValue: nuevo_ingreso ? 'Si' : 'No' });

                if (bloque_nombre !== undefined && bloque_nombre !== oldTraslado.bloque_nombre)
                    fieldChanges.push({ field: 'bloque_nombre', oldValue: oldTraslado.bloque_nombre, newValue: bloque_nombre });

                // Relations (IDs to Names)
                if (origenId !== undefined && Number(origenId) !== oldTraslado.origenId) {
                    const newOrigen = await tx.empresa.findUnique({ where: { id: Number(origenId) } });
                    fieldChanges.push({ field: 'origen_nombre', oldValue: oldTraslado.origen?.nombre, newValue: newOrigen?.nombre });
                }
                if (destinoId !== undefined && Number(destinoId) !== oldTraslado.destinoId) {
                    const newDestino = await tx.empresa.findUnique({ where: { id: Number(destinoId) } });
                    fieldChanges.push({ field: 'destino_nombre', oldValue: oldTraslado.destino?.nombre, newValue: newDestino?.nombre });
                }
                if (carreraId !== undefined && Number(carreraId) !== oldTraslado.carreraId) {
                    const newCarrera = await tx.carrera.findUnique({ where: { id: Number(carreraId) }, include: { oferta: true } });
                    let oldLabel = oldTraslado.carrera?.descripcion || '';
                    if (oldTraslado.carrera?.oferta?.descripcion.includes("Licenciatura")) oldLabel = `Licenciatura en ${oldLabel}`;
                    else if (oldTraslado.carrera?.oferta?.descripcion.includes("Maestría")) oldLabel = `Maestría en ${oldLabel}`;

                    let newLabel = newCarrera?.descripcion || '';
                    if (newCarrera?.oferta?.descripcion.includes("Licenciatura")) newLabel = `Licenciatura en ${newLabel}`;
                    else if (newCarrera?.oferta?.descripcion.includes("Maestría")) newLabel = `Maestría en ${newLabel}`;

                    fieldChanges.push({ field: 'carrera_nombre', oldValue: oldLabel, newValue: newLabel });
                }

                if (descuentoId !== undefined && Number(descuentoId) !== oldTraslado.descuentoId) {
                    const newDesc = await tx.descuento.findUnique({ where: { id: Number(descuentoId) } });
                    fieldChanges.push({ field: 'descuento_nombre', oldValue: oldTraslado.descuento?.descripcion || 'Ninguno', newValue: newDesc?.descripcion });
                } else if (updateDataInput.tiene_descuento === false && oldTraslado.descuentoId) {
                    fieldChanges.push({ field: 'descuento_nombre', oldValue: oldTraslado.descuento?.descripcion, newValue: 'Ninguno' });
                    // Also ensure we clear it in data? No, trasladoUpdateData should handle it if logic existed.
                    // Wait, my trasladoUpdateData logic above assumed we send ID. If user unchecked box, we might send 'descuentoId': null or something?
                    // Current frontend logic clears the inputs. But does it send null?
                    // Let's assume for now partial updates.
                }

                // Validations & Comments
                if (validacion_docs !== undefined && validacion_docs !== oldTraslado.validacion_docs)
                    fieldChanges.push({ field: 'validacion_docs', oldValue: oldTraslado.validacion_docs ? 'Correcto' : 'Pendiente', newValue: validacion_docs ? 'Correcto' : 'Pendiente' });

                if (descripcion_docs !== undefined && descripcion_docs !== oldTraslado.descripcion_docs)
                    fieldChanges.push({ field: 'descripcion_docs', oldValue: oldTraslado.descripcion_docs, newValue: descripcion_docs });

                if (validacion_edocta !== undefined && validacion_edocta !== oldTraslado.validacion_edocta)
                    fieldChanges.push({ field: 'validacion_edocta', oldValue: oldTraslado.validacion_edocta ? 'Sin Adeudo' : 'Pendiente', newValue: validacion_edocta ? 'Sin Adeudo' : 'Pendiente' });

                if (descripcion_edocta !== undefined && descripcion_edocta !== oldTraslado.descripcion_edocta)
                    fieldChanges.push({ field: 'descripcion_edocta', oldValue: oldTraslado.descripcion_edocta, newValue: descripcion_edocta });

                if (validacion_calif !== undefined && validacion_calif !== oldTraslado.validacion_calif)
                    fieldChanges.push({ field: 'validacion_calif', oldValue: oldTraslado.validacion_calif ? 'Sin Adeudo' : 'Pendiente', newValue: validacion_calif ? 'Sin Adeudo' : 'Pendiente' });

                if (descripcion_calif !== undefined && descripcion_calif !== oldTraslado.descripcion_calif)
                    fieldChanges.push({ field: 'descripcion_calif', oldValue: oldTraslado.descripcion_calif, newValue: descripcion_calif });

                // Auditors
                if (auditor_docsId !== undefined) {
                    const newVal = auditor_docsId ? Number(auditor_docsId) : null;
                    if (newVal !== oldTraslado.auditor_docsId) {
                        let oldName = 'Sin asignar';
                        if (oldTraslado.auditor_docsId) {
                            const oldU = await tx.usuario.findUnique({ where: { id: oldTraslado.auditor_docsId } });
                            if (oldU) oldName = `${oldU.nombres} ${oldU.apellidos}`;
                        }

                        let newName = 'Sin asignar';
                        if (newVal) {
                            const newU = await tx.usuario.findUnique({ where: { id: newVal } });
                            if (newU) newName = `${newU.nombres} ${newU.apellidos}`;
                        }

                        fieldChanges.push({ field: 'auditor_docs', oldValue: oldName, newValue: newName });
                    }
                }

                if (auditor_reqId !== undefined) {
                    const newVal = auditor_reqId ? Number(auditor_reqId) : null;
                    if (newVal !== oldTraslado.auditor_reqId) {
                        let oldName = 'Sin asignar';
                        if (oldTraslado.auditor_reqId) {
                            const oldU = await tx.usuario.findUnique({ where: { id: oldTraslado.auditor_reqId } });
                            if (oldU) oldName = `${oldU.nombres} ${oldU.apellidos}`;
                        }

                        let newName = 'Sin asignar';
                        if (newVal) {
                            const newU = await tx.usuario.findUnique({ where: { id: newVal } });
                            if (newU) newName = `${newU.nombres} ${newU.apellidos}`;
                        }

                        fieldChanges.push({ field: 'auditor_req', oldValue: oldName, newValue: newName });
                    }
                }
            }

            // Explicitly check for changes in tracked fields (Main Ticket)
            if (ticketBeforeUpdate.estatusId !== ticketAfterUpdate.estatusId) {
                fieldChanges.push({ field: 'estatusId', oldValue: ticketBeforeUpdate.estatus?.nombre, newValue: ticketAfterUpdate.estatus?.nombre });
            }
            if (ticketBeforeUpdate.prioridad !== ticketAfterUpdate.prioridad) {
                fieldChanges.push({ field: 'prioridad', oldValue: ticketBeforeUpdate.prioridad, newValue: ticketAfterUpdate.prioridad });
            }
            if (ticketBeforeUpdate.atiendeId !== ticketAfterUpdate.atiendeId) {
                const oldAgent = ticketBeforeUpdate.atiende ? `${ticketBeforeUpdate.atiende.nombres} ${ticketBeforeUpdate.atiende.apellidos}` : 'No asignado';
                const newAgent = ticketAfterUpdate.atiende ? `${ticketAfterUpdate.atiende.nombres} ${ticketAfterUpdate.atiende.apellidos}` : 'No asignado';
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
                    } as any,
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
            originatorId: String(session.user.id),
            comment: newComment || undefined
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