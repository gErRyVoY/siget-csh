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
        // 1. Categoria "Alumno" y Subcategoria "Traslado"
        const categoria = await prisma.categoria.findFirst({ where: { nombre: 'Alumno' } });
        const subcategoria = await prisma.subcategoria.findFirst({ where: { nombre: 'Traslado' } });

        if (!categoria || !subcategoria) {
            console.error('Categoria "Alumno" o Subcategoria "Traslado" no encontrada.');
            return new Response(JSON.stringify({ message: 'Error de configuración: Categoría/Subcategoría no encontrada.' }), { status: 500 });
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
            const descuento = await prisma.descuento.findFirst({ where: { monto: monto, activo: true } });
            if (descuento) {
                descuentoId = descuento.id;
            }
        }

        // --- Resolve Carrera URL/Name to ID ---
        // Seed has short names like "Administración", form sends "Licenciatura en Administración"
        const cleanCarreraName = carrera.replace(/^(Licenciatura en |Maestría en )/g, '').trim();
        const carreraEntity = await prisma.carrera.findFirst({
            where: { descripcion: { contains: cleanCarreraName, mode: 'insensitive' } }
        });
        const carreraId = carreraEntity?.id || 1;

        // 4. Auditors ... (unchanged code for auditors logic, assuming it's above or I include it)
        // Find User with auditor_docs = true. 
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
                    subcategoriaId: subcategoria.id,
                    descripcion: `Traslado solicitado de ${campusOrigen} a ${campusDestino} para la carrera ${carrera}.`,
                    afectado_clave: matricula,
                    afectado_nombre: nombreCompleto,
                    traslados: {
                        create: {
                            matricula,
                            alumno: nombreCompleto,
                            folio: matricula.replace(/\D/g, '').slice(0, 10), // Clean folio
                            origenId: empresaOrigen.id,
                            destinoId: empresaDestino.id,
                            carreraId: carreraId,
                            bloqueId: null, // Optional now
                            bloque_nombre: bloqueSugerido ? String(bloqueSugerido) : null,
                            descuentoId,
                            auditor_docsId: auditorDocs?.id,
                            auditor_reqId: auditorReq?.id,
                        }
                    }
                },
                include: { traslados: true }
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
