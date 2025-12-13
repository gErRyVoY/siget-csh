import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { prisma } from '@/lib/db';
import { findBestAgentHybrid } from '@/services/ticketAssignmentService';
import { sendNotification } from '../notifications/sse';

export const POST: APIRoute = async ({ request }) => {
    const session = await getSession(request);
    if (!session || !session.user || !session.user.id) {
        return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
    }

    try {
        const data = await request.json();
        const {
            matricula,
            'nombre-completo': nombreCompleto,
            'campus-origen': campusOrigen,
            'campus-destino': campusDestino,
            carrera,
            'tiene-descuento': tieneDescuento,
            'descuento-valor': descuentoValor,
            escolarizada,
            'bloque-sugerido': bloqueSugerido,
        } = data;

        // Parse Bloque
        let bloque = 0;
        if (typeof bloqueSugerido === 'string') {
            const match = bloqueSugerido.match(/\d+/);
            if (match) bloque = parseInt(match[0], 10);
        } else if (typeof bloqueSugerido === 'number') {
            bloque = bloqueSugerido;
        }

        // --- Validation ---
        if (!matricula || !nombreCompleto || !campusOrigen || !campusDestino || !carrera) {
            return new Response(JSON.stringify({ message: 'Faltan campos requeridos.' }), { status: 400 });
        }

        if (campusOrigen === campusDestino) {
            return new Response(JSON.stringify({ message: 'El campus destino no puede ser igual al origen.' }), { status: 400 });
        }

        // --- Resolve Entities ---
        // 1. Categoria "Traslado"
        const categoria = await prisma.categoria.findFirst({ where: { nombre: 'Traslados' } }); // Adjust name if needed (Traslado/Traslados)
        if (!categoria) {
            // Fallback or Error? Assuming 'Traslados' exists from seed.
            console.error('Categoria "Traslados" no encontrada.');
            return new Response(JSON.stringify({ message: 'Error de configuración: Categoría no encontrada.' }), { status: 500 });
        }

        // 2. Empresas (Campus)
        const empresaOrigen = await prisma.empresa.findFirst({ where: { nombre: campusOrigen } });
        const empresaDestino = await prisma.empresa.findFirst({ where: { nombre: campusDestino } });

        if (!empresaOrigen || !empresaDestino) {
            return new Response(JSON.stringify({ message: 'Campus no encontrado en el sistema.' }), { status: 400 });
        }

        // 3. Descuento
        let descuentoId = 1; // Default "N/A" (ID 1 from seed)
        if (tieneDescuento && descuentoValor) {
            const monto = parseInt(descuentoValor, 10);
            const descuento = await prisma.descuento.findFirst({ where: { monto: monto, active: true } });
            if (descuento) {
                descuentoId = descuento.id;
            } else {
                // Should we create it or fail? 
                // For now, fail to enforce seed usage, or fallback to closest? 
                // Let's fallback to N/A or maybe the seed logic requires specific values.
                // But to be safe, if provided value is not found, we refrain from setting an invalid ID.
                // Or maybe searching by description?
            }
        }

        // 4. Auditors
        // Find User with auditor_docs = true. 
        // Logic: Look in Campus Origen? Or Global? 
        // Usually admin auditors might be central or per campus. 
        // I'll search in empresaOrigen first, if not found then any.
        let auditorDocs = await prisma.usuario.findFirst({
            where: { auditor_docs: true, empresaId: empresaOrigen.id, activo: true }
        });
        if (!auditorDocs) {
            auditorDocs = await prisma.usuario.findFirst({
                where: { auditor_docs: true, activo: true }
            });
        }

        let auditorReq = await prisma.usuario.findFirst({
            where: { auditor_req: true, empresaId: empresaOrigen.id, activo: true }
        });
        if (!auditorReq) {
            auditorReq = await prisma.usuario.findFirst({
                where: { auditor_req: true, activo: true }
            });
        }

        // --- Ticket Creation ---
        const solicitanteId = parseInt(session.user.id as string, 10);

        // Assign Agent (Owner of the Ticket)
        const assignmentResult = await findBestAgentHybrid({
            solicitanteId,
            categoriaId: categoria.id,
        });
        const atiendeId = assignmentResult.agentId;

        // Create Transaction
        const [nuevoTicket] = await prisma.$transaction([
            prisma.ticket.create({
                data: {
                    solicitanteId,
                    atiendeId,
                    estatusId: atiendeId ? 2 : 1, // Nuevo(2) or Sin Asignar(1)
                    empresaId: empresaOrigen.id, // Ticket belongs to Origin Campus?
                    prioridad: 'Media',
                    categoriaId: categoria.id,
                    descripcion: `Traslado solicitado de ${campusOrigen} a ${campusDestino} para la carrera ${carrera}.`,
                    afectado_clave: matricula,
                    afectado_nombre: nombreCompleto,
                    traslado: {
                        create: {
                            matricula,
                            nombre: nombreCompleto,
                            campus_origen: campusOrigen,
                            campus_destino: campusDestino,
                            carrera,
                            semestre: 0, // Not in form?
                            bloque: bloque,
                            descuentoId,
                            auditor_docsId: auditorDocs?.id,
                            auditor_reqId: auditorReq?.id,
                            // Defaults for validations are false
                        }
                    }
                },
                include: { traslado: true }
            }),
            ...(atiendeId ? [
                prisma.usuario.update({
                    where: { id: atiendeId },
                    data: { carga_actual: { increment: 1 } }
                })
            ] : [])
        ]);

        // --- Notification ---
        const notificationPayload = {
            type: 'ticket_created' as const,
            message: `Nuevo Traslado #${nuevoTicket.id} creado.`,
            ticketId: nuevoTicket.id,
            originatorId: String(session.user.id)
        };

        const targetUsers: number[] = [];
        if (atiendeId) targetUsers.push(atiendeId);
        if (auditorDocs) targetUsers.push(auditorDocs.id);
        if (auditorReq && auditorReq.id !== auditorDocs?.id) targetUsers.push(auditorReq.id);

        // Send notifications
        sendNotification(notificationPayload, targetUsers.length > 0 ? targetUsers : undefined);

        return new Response(JSON.stringify(nuevoTicket), { status: 201 });

    } catch (error) {
        console.error('Error creating transfer ticket:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor.' }), { status: 500 });
    }
};
