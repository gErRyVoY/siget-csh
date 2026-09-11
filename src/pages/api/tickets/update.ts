import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';
import type { Prisma, Prioridad } from '@prisma/client';
import { sendNotification } from '../notifications/sse';
import { sendTicketNotification } from '@/services/emailService';
import { canAgentBeAssignedManually, canAssignMarketingTickets } from '@/services/ticketAssignmentService';
import { MAX_AFECTADO_CLAVE, MAX_AFECTADO_NOMBRE } from '@/lib/ticket-limits';
import { MARKETING_CATEGORY_ID } from '@/config/ticket-categories';

const PRIVILEGED_ROLES = [2, 3]; // admin y superadmin

export const PATCH: APIRoute = async ({ request, locals }) => {
    const session = locals.session;
    if (!session || !session.user) {
        return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
    }

    try {
        const data = await request.json();
        const { ticketId, newComment, newFiles, afectado_clave, afectado_nombre, descripcion, origen, ...updateDataInput } = data;
        // Los wizards de creación cierran el alta con un PATCH para adjuntar los archivos
        // subidos a S3. Ese PATCH no es "un resolutor trabajando el ticket", así que se
        // marca con origen: 'creacion' para que no dispare la transición automática.
        const esPatchDeCreacion = origen === 'creacion';
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
        if (updateDataInput.estatusId) {
            const newEstatusId = Number(updateDataInput.estatusId);
            if (!isPrivileged) {
                const targetEstatus = await prisma.estatus.findUnique({ where: { id: newEstatusId } });
                if (targetEstatus && newEstatusId !== ticketBeforeUpdate.estatusId && (targetEstatus.nombre === 'Nuevo' || targetEstatus.nombre === 'Duplicado' || targetEstatus.nombre === 'Sin asignar')) {
                    return new Response(JSON.stringify({ message: 'No tienes permiso para cambiar a este estatus' }), { status: 403 });
                }
            }
            updateData.estatus = { connect: { id: newEstatusId } };
        }

        // El formulario de la vista de ticket envía SIEMPRE el valor del <select> de estatus,
        // aunque el resolutor no lo haya tocado. Por eso "no cambió el estatus" no se puede
        // detectar con `!updateDataInput.estatusId`: hay que comparar el valor enviado con el
        // actual. Con la comprobación anterior las dos transiciones automáticas de más abajo
        // (a 'Nuevo' al reasignar y a 'En progreso' al trabajar un ticket nuevo) nunca se
        // disparaban desde la interfaz.
        const estatusIdEnviado = updateDataInput.estatusId ? Number(updateDataInput.estatusId) : null;
        const estatusSinCambioExplicito = estatusIdEnviado === null || estatusIdEnviado === ticketBeforeUpdate.estatusId;
        if (updateDataInput.solicitanteId && isPrivileged) updateData.solicitante = { connect: { id: Number(updateDataInput.solicitanteId) } };
        
        const isSuperAdmin = userRoleId === 3;
        const isAdmin = userRoleId === 2;
        // Misma regla que la vista del ticket (src/pages/tickets/view/[id].astro):
        // los tickets de Marketing entran «Sin asignar» y el equipo los reparte a
        // mano, así que mientras no tengan dueño cualquier admin del equipo de
        // Marketing puede asignarlos. Las dos condiciones baratas van antes del
        // `await` para no consultar la BD en cada PATCH que no es de Marketing.
        const puedeTriarMarketing =
            isPrivileged
            && ticketBeforeUpdate.categoriaId === MARKETING_CATEGORY_ID
            && ticketBeforeUpdate.atiendeId === null
            && await canAssignMarketingTickets(currentUserId);
        // Superadmin puede reasignar siempre
        // Admin solo puede reasignar si el ticket está asignado a él mismo y no es el creador
        const canEditAtiende = isSuperAdmin
            || (isAdmin && !isOwner && ticketBeforeUpdate.atiendeId === currentUserId)
            || puedeTriarMarketing;

        if ('atiendeId' in updateDataInput && canEditAtiende) {
            const parsedAtiendeId = Number(updateDataInput.atiendeId);
            if (parsedAtiendeId > 0) {
                const validation = await canAgentBeAssignedManually(
                    parsedAtiendeId,
                    ticketBeforeUpdate.categoriaId,
                    ticketBeforeUpdate.subcategoriaId
                );
                if (!validation.canAssign) {
                    return new Response(JSON.stringify({ message: validation.reason || 'El usuario seleccionado no puede atender este ticket.' }), { status: 400 });
                }
                updateData.atiende = { connect: { id: parsedAtiendeId } };
            } else if (ticketBeforeUpdate.atiendeId !== null) {
                updateData.atiende = { disconnect: true };
            }
        }
        if (updateDataInput.prioridad && isPrivileged) updateData.prioridad = updateDataInput.prioridad as Prioridad;
        if (typeof updateDataInput.archivado === 'boolean' && isPrivileged) updateData.archivado = updateDataInput.archivado;

        // El formulario de la vista de ticket permite editar estos dos campos, así que
        // aquí valen los mismos límites que en el alta: sin la guarda, un valor largo
        // sale de Prisma como P2000 y el PATCH responde 500 en lugar de decir qué pasó.
        if (typeof afectado_clave === 'string') {
            if (afectado_clave.length > MAX_AFECTADO_CLAVE) {
                return new Response(
                    JSON.stringify({ message: `El identificador del afectado no puede exceder ${MAX_AFECTADO_CLAVE} caracteres.` }),
                    { status: 400 }
                );
            }
            updateData.afectado_clave = afectado_clave;
        }
        if (typeof afectado_nombre === 'string') {
            if (afectado_nombre.length > MAX_AFECTADO_NOMBRE) {
                return new Response(
                    JSON.stringify({ message: `El nombre del afectado no puede exceder ${MAX_AFECTADO_NOMBRE} caracteres.` }),
                    { status: 400 }
                );
            }
            updateData.afectado_nombre = afectado_nombre;
        }
        if (typeof descripcion === 'string') updateData.descripcion = descripcion;

        // --- Traslado Logic ---
        const ticketWithTraslado = await prisma.ticket.findUnique({
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
        const oldTraslado = ticketWithTraslado?.traslados;

        // Fields specific to Traslado
        const {
            matricula,
            alumno,
            origenId,
            destinoId,
            carreraId,
            nuevo_ingreso,
            tiene_descuento,
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

        // Validación: El ingeniero asignado no puede ser el mismo auditor
        let finalAtiendeId: number | null = ticketBeforeUpdate.atiendeId;
        if ('atiendeId' in updateDataInput) {
            const parsed = Number(updateDataInput.atiendeId);
            finalAtiendeId = parsed > 0 ? parsed : null;
        }

        let finalAuditorDocsId: number | null = oldTraslado?.auditor_docsId ?? null;
        if (auditor_docsId !== undefined) {
            finalAuditorDocsId = auditor_docsId ? Number(auditor_docsId) : null;
        }

        let finalAuditorReqId: number | null = oldTraslado?.auditor_reqId ?? null;
        if (auditor_reqId !== undefined) {
            finalAuditorReqId = auditor_reqId ? Number(auditor_reqId) : null;
        }

        if (finalAtiendeId !== null) {
            if (finalAtiendeId === finalAuditorDocsId) {
                return new Response(JSON.stringify({ message: 'El ingeniero asignado no puede ser el auditor de documentos.' }), { status: 400 });
            }
            if (finalAtiendeId === finalAuditorReqId) {
                return new Response(JSON.stringify({ message: 'El ingeniero asignado no puede ser el auditor de adeudos.' }), { status: 400 });
            }
        }

        let trasladoUpdateData: any = {};
        if (isPrivileged) {
            if (matricula !== undefined) trasladoUpdateData.matricula = matricula;
            if (alumno !== undefined) trasladoUpdateData.alumno = alumno;
            if (origenId) trasladoUpdateData.origenId = Number(origenId);
            if (destinoId) trasladoUpdateData.destinoId = Number(destinoId);
            if (carreraId) trasladoUpdateData.carreraId = Number(carreraId);
        }
        if (typeof nuevo_ingreso === 'boolean') trasladoUpdateData.nuevo_ingreso = nuevo_ingreso;
        if (bloque_nombre !== undefined) {
            const normalizedBloque = (bloque_nombre === null || bloque_nombre === '0' || bloque_nombre === 'null' || bloque_nombre === '') ? null : bloque_nombre;
            if (normalizedBloque !== (oldTraslado?.bloque_nombre ?? null)) {
                trasladoUpdateData.bloque_nombre = normalizedBloque;
            }
        }
        if (bloqueId) trasladoUpdateData.bloqueId = bloqueId === 'null' ? null : Number(bloqueId);
        
        if (descuentoId) {
            trasladoUpdateData.descuentoId = Number(descuentoId);
        } else if (tiene_descuento !== undefined) {
            if (tiene_descuento === false) {
                trasladoUpdateData.descuentoId = 1; // N/A
            } else if (descuento_nombre) {
                const descuento = await prisma.descuento.findFirst({
                    where: { descripcion: descuento_nombre, activo: true }
                });
                if (descuento) {
                    trasladoUpdateData.descuentoId = descuento.id;
                }
            }
        }

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
        // El `canEditAtiende` importa: sin él, un PATCH que trae `atiendeId` de alguien
        // que no puede reasignar movía el ticket a «Nuevo» sin haber asignado a nadie,
        // dejándolo como el ticket #23 (estatus «Nuevo» y `atiendeId` nulo). Ahora que
        // los tickets de Marketing entran siempre «Sin asignar», ese desajuste sería
        // fácil de provocar.
        if (canEditAtiende && updateDataInput.atiendeId && Number(updateDataInput.atiendeId) !== ticketBeforeUpdate.atiendeId) {
            if (estatusSinCambioExplicito) {
                updateData.estatus = { connect: { id: 2 } };
            }
        } else {
            // Auto-set status to 'En progreso' (3) if Resolver updates a 'Nuevo' ticket and didn't change status
            if (isPrivileged && !esPatchDeCreacion && ticketBeforeUpdate.estatusId === 2 && estatusSinCambioExplicito) {
                updateData.estatus = { connect: { id: 3 } };
            }
        }

        if (Array.isArray(newFiles) && newFiles.length > 0) {
            const existingArchivos = (ticketBeforeUpdate as any).archivos || [];
            (updateData as any).archivos = [...existingArchivos, ...newFiles];
        }

        let hasNewHistory = false;

        const updatedTicket = await prisma.$transaction(async (tx) => {
            const ticketAfterUpdate = await tx.ticket.update({
                where: { id: ticketId },
                data: updateData,
                include: { estatus: true, atiende: true }
            });

            // --- Actualización de carga_actual por reasignación manual ---
            if (ticketBeforeUpdate.atiendeId !== ticketAfterUpdate.atiendeId) {
                if (ticketBeforeUpdate.atiendeId) {
                    await tx.usuario.updateMany({
                        where: { 
                            id: ticketBeforeUpdate.atiendeId,
                            carga_actual: { gt: 0 }
                        },
                        data: { carga_actual: { decrement: 1 } }
                    });
                }
                if (ticketAfterUpdate.atiendeId) {
                    await tx.usuario.update({
                        where: { id: ticketAfterUpdate.atiendeId },
                        data: { carga_actual: { increment: 1 } }
                    });
                }
            }

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

                if (bloque_nombre !== undefined) {
                    const normalizedBloque = (bloque_nombre === null || bloque_nombre === '0' || bloque_nombre === 'null' || bloque_nombre === '') ? null : bloque_nombre;
                    const oldBloque = oldTraslado.bloque_nombre ?? null;
                    if (normalizedBloque !== oldBloque) {
                        fieldChanges.push({ field: 'bloque_nombre', oldValue: oldBloque || 'Ninguno', newValue: normalizedBloque || 'Ninguno' });
                    }
                }

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
                hasNewHistory = true;
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

        // Enviar correos de notificación de forma asíncrona en background
        (async () => {
            try {
                // Obtener datos del solicitante, agente y categoría del ticket
                const [solicitante, agente, categoria] = await Promise.all([
                    prisma.usuario.findUnique({
                        where: { id: ticketBeforeUpdate.solicitanteId },
                        select: { nombres: true, apellidos: true, mail: true }
                    }),
                    updatedTicket.atiendeId ? prisma.usuario.findUnique({
                        where: { id: updatedTicket.atiendeId },
                        select: { nombres: true, apellidos: true, mail: true }
                    }) : null,
                    prisma.categoria.findUnique({
                        where: { id: updatedTicket.categoriaId },
                        select: { nombre: true }
                    })
                ]);

                const solicitanteNombre = solicitante ? `${solicitante.nombres} ${solicitante.apellidos}` : "Usuario";
                const agenteNombre = agente ? `${agente.nombres} ${agente.apellidos}` : "No asignado";
                const originUrl = new URL(request.url).origin;

                const ticketInfo = {
                    categoria: categoria?.nombre || "General",
                    descripcion: updatedTicket.descripcion || "",
                    prioridad: updatedTicket.prioridad,
                    solicitanteNombre,
                    agenteNombre,
                    estatus: updatedTicket.estatus?.nombre || "",
                    comentario: newComment || undefined
                };

                // 1. Notificación de Reasignación de Agente
                if (ticketBeforeUpdate.atiendeId !== updatedTicket.atiendeId && updatedTicket.atiendeId) {
                    if (agente && agente.mail) {
                        await sendTicketNotification({
                            ticketId,
                            event: "ticket_asignado",
                            destinatarioId: updatedTicket.atiendeId,
                            destinatarioMail: agente.mail,
                            originUrl,
                            fromName: solicitanteNombre,
                            ticketInfo
                        });
                    }

                    // Notificar al solicitante si el ticket pasó de SIN ASIGNAR → CON AGENTE
                    // (primera asignación vía panel admin: el solicitante ahora sabe quién lo atiende)
                    if (!ticketBeforeUpdate.atiendeId && solicitante && solicitante.mail) {
                        await sendTicketNotification({
                            ticketId,
                            event: "ticket_creado_solicitante",
                            destinatarioId: ticketBeforeUpdate.solicitanteId,
                            destinatarioMail: solicitante.mail,
                            originUrl,
                            fromName: agenteNombre,
                            ticketInfo
                        });
                    }
                }

                // 2. Notificación de Actualización (Estatus o Comentario)
                const estatusCambio = ticketBeforeUpdate.estatusId !== updatedTicket.estatusId;
                const hayComentario = !!newComment;

                if (estatusCambio || hayComentario) {
                    // Notificar al solicitante (si no fue él quien actualizó)
                    if (currentUserId !== ticketBeforeUpdate.solicitanteId && solicitante && solicitante.mail) {
                        await sendTicketNotification({
                            ticketId,
                            event: "ticket_actualizado",
                            destinatarioId: ticketBeforeUpdate.solicitanteId,
                            destinatarioMail: solicitante.mail,
                            originUrl,
                            fromName: agenteNombre,
                            ticketInfo
                        });
                    }

                    // Notificar al agente asignado (si hay agente y no fue él quien actualizó,
                    // y tampoco se le acaba de reasignar, porque en ese caso ya se le envió el correo de ticket_asignado)
                    const agenteReasignado = ticketBeforeUpdate.atiendeId !== updatedTicket.atiendeId;
                    if (updatedTicket.atiendeId && currentUserId !== updatedTicket.atiendeId && !agenteReasignado && agente && agente.mail) {
                        await sendTicketNotification({
                            ticketId,
                            event: "ticket_actualizado",
                            destinatarioId: updatedTicket.atiendeId,
                            destinatarioMail: agente.mail,
                            originUrl,
                            fromName: solicitanteNombre,
                            ticketInfo
                        });
                    }
                }
            } catch (emailErr) {
                console.error('[EmailNotificationError] Error al procesar notificación de actualización de ticket:', emailErr);
            }
        })();

        return new Response(JSON.stringify({ ...updatedTicket, hasNewHistoryEntry: hasNewHistory }), { status: 200 });

    } catch (error: any) {
        console.error('Error updating ticket:', error.message, error.stack);
        return new Response(JSON.stringify({ message: 'Error interno del servidor', error: error.message }), { status: 500 });
    }
};