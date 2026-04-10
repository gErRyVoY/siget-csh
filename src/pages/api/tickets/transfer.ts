import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { findBestAgentHybrid } from '@/services/ticketAssignmentService';
import { sendNotification } from '../notifications/sse';
import { ensureActiveCycle } from '@/services/cycleService';

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const { db } = locals;

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
            comentarios,
            mail,
            mail_escuela,
            telefono,
            tel_movil,
            plan_pago_api,
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
        if (!matricula || !nombreCompleto || !campusOrigen || !campusDestino || !carrera || !bloqueSugerido) {
            return new Response(JSON.stringify({ message: 'Faltan campos requeridos.' }), { status: 400 });
        }

        if (campusOrigen === campusDestino) {
            return new Response(JSON.stringify({ message: 'El campus destino no puede ser igual al origen.' }), { status: 400 });
        }

        // --- Resolve Entities ---
        // 1. Categoria "Alumno" y Subcategoria "Traslado"
        const categoria = await db.categoria.findFirst({ where: { nombre: 'Alumno' } });
        const subcategoria = await db.subcategoria.findFirst({ where: { nombre: 'Traslado' } });

        if (!categoria || !subcategoria) {
            console.error('Categoria "Alumno" o Subcategoria "Traslado" no encontrada.');
            return new Response(JSON.stringify({ message: 'Error de configuración: Categoría/Subcategoría no encontrada.' }), { status: 500 });
        }

        // 2. Empresas (Campus)
        const empresaOrigen = await db.empresa.findFirst({ where: { nombre: campusOrigen } });
        const empresaDestino = await db.empresa.findFirst({ where: { nombre: campusDestino } });

        if (!empresaOrigen || !empresaDestino) {
            return new Response(JSON.stringify({ message: 'Campus no encontrado en el sistema.' }), { status: 400 });
        }

        // 3. Descuento
        let descuentoId = 1; // Default "N/A" (ID 1 from seed)
        if (tieneDescuento && descuentoValor) {
            // descuentoValor is now the NAME (string), not monto (int)
            const descuento = await db.descuento.findFirst({ where: { descripcion: descuentoValor, activo: true } });
            if (descuento) {
                descuentoId = descuento.id;
            } else {
                // Fallback or Error? 
                // If validation is strict in front, maybe error. But let's keep it safe.
                // Actually, let's try to match partial? No, exact match from autocomplete.
            }
        }


        // --- Resolve Carrera URL/Name to ID ---
        // Seed has short names like "Administración", form sends "Licenciatura en Administración"
        const cleanCarreraName = carrera.replace(/^(Licenciatura en |Maestría en )/g, '').trim();
        const carreraEntity = await db.carrera.findFirst({
            where: { descripcion: { contains: cleanCarreraName, mode: 'insensitive' } }
        });
        const carreraId = carreraEntity?.id || 1;

        // 3.5 Resolve Plan de Pago from API string
        let planpagoId: number | null = null;
        if (plan_pago_api) {
            const planes = await db.planPago.findMany({ where: { activo: true } });
            const upperApi = String(plan_pago_api).toUpperCase();
            for (const p of planes) {
                if (upperApi.includes(p.nombre.toUpperCase())) {
                    planpagoId = p.id;
                    break;
                }
            }
        }

        // 4. Auditors ... (unchanged code for auditors logic, assuming it's above or I include it)
        // Find User with auditor_docs = true. 
        let auditorDocs = await db.usuario.findFirst({
            where: { auditor_docs: true, empresaId: empresaOrigen.id, activo: true }
        });
        if (!auditorDocs) {
            auditorDocs = await db.usuario.findFirst({
                where: { auditor_docs: true, activo: true }
            });
        }

        let auditorReq = await db.usuario.findFirst({
            where: { auditor_req: true, empresaId: empresaOrigen.id, activo: true }
        });
        if (!auditorReq) {
            auditorReq = await db.usuario.findFirst({
                where: { auditor_req: true, activo: true }
            });
        }

        // ... (rest of imports)


        // ... (rest of imports)

        // Inside handler ...
        // --- Active Cycle (Auto-update) ---
        const activeCycle = await ensureActiveCycle(db);

        if (!activeCycle) {
            return new Response(JSON.stringify({ message: 'No hay un ciclo escolar activo en este momento. No se pueden crear traslados.' }), { status: 400 });
        }

        // --- Check for Duplicates (Per Cycle) ---
        // At this point activeCycle is guaranteed valid
        const existingTrasladoInCycle = await db.traslado.findFirst({
            where: {
                matricula,
                ticket: {
                    cicloId: activeCycle.id,
                    estatus: {
                        nombre: { not: 'Cancelado' }
                    }
                }
            }
        });
        if (existingTrasladoInCycle) {
            return new Response(JSON.stringify({ message: 'Ya existe una solicitud de traslado para esta matrícula en el ciclo actual.' }), { status: 409 });
        }

        // --- Ticket Creation ---
        const solicitanteId = parseInt(session.user.id as string, 10);

        // Assign Agent (Owner of the Ticket)
        const assignmentResult = await findBestAgentHybrid({
            db,
            solicitanteId,
            categoriaId: categoria.id,
            subcategoriaId: subcategoria.id,
        });
        const atiendeId = assignmentResult.agentId;

        let descripcionTicket = `Traslado solicitado de ${campusOrigen} a ${campusDestino} para la carrera ${carrera}.`;
        if (comentarios) {
            descripcionTicket += `\n\nComentarios:\n${comentarios}`;
        }

        // Create Transaction
        const [nuevoTicket] = await db.$transaction(async (tx: any) => {
            // 1. Create Ticket
            const ticket = await tx.ticket.create({
                data: {
                    solicitanteId,
                    atiendeId,
                    estatusId: atiendeId ? 2 : 1, // Nuevo(2) or Sin Asignar(1)
                    empresaId: empresaOrigen.id, // Ticket belongs to Origin Campus?
                    prioridad: 'Media',
                    categoriaId: categoria.id,
                    subcategoriaId: subcategoria.id,
                    descripcion: descripcionTicket,
                    afectado_clave: matricula,
                    afectado_nombre: nombreCompleto,
                    cicloId: activeCycle?.id,
                }
            });

            // 2. Create Traslado with TRL-{id} folio
            await tx.traslado.create({
                data: {
                    ticketId: ticket.id,
                    matricula,
                    alumno: nombreCompleto,
                    folio: `TRL-${ticket.id}`, // Custom Folio Logic
                    origenId: empresaOrigen.id,
                    destinoId: empresaDestino.id,
                    carreraId: carreraId,
                    bloqueId: null, // Optional now
                    bloque_nombre: bloqueSugerido ? String(bloqueSugerido) : null,
                    descuentoId,
                    planpagoId: planpagoId,
                    mail: mail ? String(mail) : null,
                    mail_escuela: mail_escuela ? String(mail_escuela) : null,
                    telefono: telefono ? String(telefono) : null,
                    tel_movil: tel_movil ? String(tel_movil) : null,
                    auditor_docsId: auditorDocs?.id,
                    auditor_reqId: auditorReq?.id,
                }
            });

            // 3. Update Agent Load if assigned
            if (atiendeId) {
                await tx.usuario.update({
                    where: { id: atiendeId },
                    data: { carga_actual: { increment: 1 } }
                });
            }

            // Return full object with relation for response
            return [await tx.ticket.findUniqueOrThrow({
                where: { id: ticket.id },
                include: { traslados: true }
            })];
        });


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
