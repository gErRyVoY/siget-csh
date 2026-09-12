import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';
import { findBestAgentHybrid } from '@/services/ticketAssignmentService';
import { sendNotification } from '../notifications/sse';
import { ensureActiveCycle } from '@/services/cycleService';
import { sendTicketNotification } from '@/services/emailService';
import { getEstadoTraslados } from '@/lib/traslados-config';

export const POST: APIRoute = async ({ request, locals }) => {
    const session = locals.session;
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
        if (!matricula || !nombreCompleto || !campusOrigen || !campusDestino || !carrera) {
            return new Response(JSON.stringify({ message: 'Faltan campos requeridos.' }), { status: 400 });
        }

        if (campusOrigen === campusDestino) {
            return new Response(JSON.stringify({ message: 'El campus destino no puede ser igual al origen.' }), { status: 400 });
        }

        // --- Periodo y ciclo de traslados (/admin/traslados) ---
        // Fuera del periodo la sección ya no existe para nadie (el callback `jwt`
        // la quita de `token.secciones` y src/middleware.ts bloquea la ruta), pero
        // este endpoint no pasa por ese guard: se revalida aquí para que un POST
        // directo tampoco cuele.
        const estadoTraslados = await getEstadoTraslados();

        if (!estadoTraslados.periodoAbierto) {
            return new Response(JSON.stringify({ message: 'El periodo de traslados está cerrado.' }), { status: 403 });
        }

        const cicloTraslados = estadoTraslados.cicloDestino;
        if (!cicloTraslados) {
            return new Response(JSON.stringify({ message: 'No hay un ciclo escolar configurado para los traslados. Revisa la programación en /admin/traslados.' }), { status: 400 });
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

        // Campus Virtual deja de admitirse como destino tras `fecha_fin_trl_virtual`.
        // Se compara por `slug`, que es único, y no por el nombre que llega del
        // formulario. Como origen sigue siendo válido siempre.
        if (empresaDestino.slug === 'virtual' && !estadoTraslados.virtualPermitido) {
            return new Response(JSON.stringify({ message: 'Campus Virtual ya no está disponible como campus destino en este periodo de traslados.' }), { status: 400 });
        }

        // 3. Descuento
        let descuentoId = 1; // Default "N/A" (ID 1 from seed)
        if (tieneDescuento && descuentoValor) {
            // descuentoValor is now the NAME (string), not monto (int)
            const descuento = await prisma.descuento.findFirst({ where: { descripcion: descuentoValor, activo: true } });
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
        const carreraEntity = await prisma.carrera.findFirst({
            where: { descripcion: { contains: cleanCarreraName, mode: 'insensitive' } }
        });
        const carreraId = carreraEntity?.id || 1;

        // 3.5 Resolve Plan de Pago from API string
        let planpagoId: number | null = null;
        if (plan_pago_api) {
            const planes = await prisma.planPago.findMany({ where: { activo: true } });
            const upperApi = String(plan_pago_api).toUpperCase();
            for (const p of planes) {
                if (upperApi.includes(p.nombre.toUpperCase())) {
                    planpagoId = p.id;
                    break;
                }
            }
        }

        // 4. Auditors - No longer automatically assigned upon creation

        // ... (rest of imports)


        // ... (rest of imports)

        // Mantiene `ciclo.activo` al día, igual que el resto de las altas de
        // ticket. El ciclo del traslado, en cambio, es `cicloTraslados`: el que
        // programa /admin/traslados, no el vigente hoy.
        await ensureActiveCycle();

        // --- Check for Duplicates (Per Cycle) ---
        // La unicidad se mide contra el ciclo destino de los traslados, que es el
        // que se va a guardar en el ticket.
        const existingTrasladoInCycle = await prisma.traslado.findFirst({
            where: {
                matricula,
                ticket: {
                    cicloId: cicloTraslados.id,
                    estatus: {
                        nombre: { not: 'Cancelado' }
                    }
                }
            }
        });
        if (existingTrasladoInCycle) {
            return new Response(JSON.stringify({ message: `Ya existe una solicitud de traslado para esta matrícula en el ciclo ${cicloTraslados.ciclo}.` }), { status: 409 });
        }

        // --- Ticket Creation ---
        const solicitanteId = parseInt(session.user.id as string, 10);

        // Assign Agent (Owner of the Ticket)
        const assignmentResult = await findBestAgentHybrid({
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
        const [nuevoTicket] = await prisma.$transaction(async (tx: any) => {
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
                    cicloId: cicloTraslados.id,
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
                    bloque_nombre: (bloqueSugerido && bloqueSugerido !== '0') ? String(bloqueSugerido) : null,
                    descuentoId,
                    planpagoId: planpagoId,
                    mail: mail ? String(mail) : null,
                    mail_escuela: mail_escuela ? String(mail_escuela) : null,
                    telefono: telefono ? String(telefono) : null,
                    tel_movil: tel_movil ? String(tel_movil) : null,
                    auditor_docsId: null,
                    auditor_reqId: null,
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

        // Send notifications
        sendNotification(notificationPayload, targetUsers.length > 0 ? targetUsers : undefined);

        // Enviar correo de notificación del traslado al agente asignado
        if (atiendeId) {
            (async () => {
                try {
                    const [agente, solicitante] = await Promise.all([
                        prisma.usuario.findUnique({
                            where: { id: atiendeId },
                            select: { nombres: true, apellidos: true, mail: true }
                        }),
                        prisma.usuario.findUnique({
                            where: { id: solicitanteId },
                            select: { nombres: true, apellidos: true }
                        })
                    ]);

                    if (agente && agente.mail) {
                        const originUrl = new URL(request.url).origin;
                        const solicitanteNombre = solicitante
                            ? `${solicitante.nombres} ${solicitante.apellidos}`
                            : "Usuario";
                        const agenteNombre = `${agente.nombres} ${agente.apellidos}`;

                        await sendTicketNotification({
                            ticketId: nuevoTicket.id,
                            event: "traslado_creado",
                            destinatarioId: atiendeId,
                            destinatarioMail: agente.mail,
                            originUrl,
                            fromName: solicitanteNombre,
                            ticketInfo: {
                                categoria: "Alumno / Traslado",
                                descripcion: descripcionTicket,
                                prioridad: "Media",
                                solicitanteNombre,
                                agenteNombre,
                                folio: `TRL-${nuevoTicket.id}`,
                                matricula,
                                alumno: nombreCompleto,
                                carrera,
                                origen: campusOrigen,
                                destino: campusDestino
                            }
                        });

                        // Notificar al creador del traslado
                        if (solicitante && solicitanteId) {
                            const solicitanteEntity = await prisma.usuario.findUnique({
                                where: { id: solicitanteId },
                                select: { mail: true }
                            });
                            
                            if (solicitanteEntity && solicitanteEntity.mail) {
                                await sendTicketNotification({
                                    ticketId: nuevoTicket.id,
                                    event: "ticket_creado_solicitante",
                                    destinatarioId: solicitanteId,
                                    destinatarioMail: solicitanteEntity.mail,
                                    originUrl,
                                    fromName: agenteNombre,
                                    ticketInfo: {
                                        categoria: "Alumno / Traslado",
                                        descripcion: descripcionTicket,
                                        prioridad: "Media",
                                        solicitanteNombre,
                                        agenteNombre,
                                    }
                                });
                            }
                        }
                    }
                } catch (emailErr) {
                    console.error('[EmailNotificationError] Error al procesar notificación de traslado creado:', emailErr);
                }
            })();
        }

        return new Response(JSON.stringify(nuevoTicket), { status: 201 });

    } catch (error) {
        console.error('Error creating transfer ticket:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor.' }), { status: 500 });
    }
};
