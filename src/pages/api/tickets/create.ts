import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { prisma } from '../../../lib/db';
import { sendNotification } from '../notifications/sse';
import { findBestAgentHybrid } from '../../../services/ticketAssignmentService';
import { ensureActiveCycle } from '../../../services/cycleService';
import { sendTicketNotification } from '../../../services/emailService';

export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request);

  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  try {
    await ensureActiveCycle();
    
    const data = await request.json();
    const { categoriaId, subcategoriaId, descripcion, afectado_clave, afectado_nombre } = data;
    const parsedCategoriaId = parseInt(categoriaId, 10);
    const parsedSubcategoriaId = subcategoriaId ? parseInt(subcategoriaId, 10) : null;

    if (isNaN(parsedCategoriaId) || !descripcion) {
      return new Response(
        JSON.stringify({ message: 'Faltan campos requeridos o son inválidos.' }),
        { status: 400 }
      );
    }

    const solicitanteId = parseInt(session.user.id as string, 10);

    if (isNaN(solicitanteId)) {
      return new Response(JSON.stringify({ message: 'ID de usuario inválido en la sesión.' }), { status: 400 });
    }

    // --- NUEVA LÓGICA DE ASIGNACIÓN HÍBRIDA ---
    const assignmentResult = await findBestAgentHybrid({
      solicitanteId,
      categoriaId: parsedCategoriaId,
      subcategoriaId: parsedSubcategoriaId,
    });

    const atiendeId = assignmentResult.agentId;
    const empresaId = session.user.empresa!.id;

    // Determinar prioridad basada en el rol del usuario
    let prioridad: 'Baja' | 'Media' | 'Alta' = 'Baja';
    const nivelSoporte = session.user.rol?.nivel_soporte;

    if (nivelSoporte) {
      switch (nivelSoporte) {
        case 'Usuario':
          prioridad = 'Baja';
          break;
        case 'S_1':
        case 'S_2':
        case 'Desarrollador':
        case 'Coordinador':
        case 'Contador':
        case 'Marketing':
          prioridad = 'Media';
          break;
        case 'S_3':
        case 'Director':
          prioridad = 'Alta';
          break;
        default:
          prioridad = 'Baja'; // Fallback
      }
    }

    let nuevoTicket;

    if (atiendeId) {
      // Agente encontrado
      [nuevoTicket] = await prisma.$transaction([
        prisma.ticket.create({
          data: {
            solicitanteId,
            atiendeId,
            estatusId: 2, // Nuevo y asignado
            empresaId,
            prioridad,
            archivado: false,
            categoriaId: parsedCategoriaId,
            subcategoriaId: parsedSubcategoriaId,
            descripcion: descripcion,
            afectado_clave: afectado_clave || null,
            afectado_nombre: afectado_nombre || null,
          },
        }),
        prisma.usuario.update({
          where: { id: atiendeId },
          data: { carga_actual: { increment: 1 } },
        }),
      ]);

      console.log(`[Ticket ${nuevoTicket.id}] Asignado a agente ${atiendeId} (tipo: ${assignmentResult.assignmentType})`);
    } else {
      // Sin agente disponible
      nuevoTicket = await prisma.ticket.create({
        data: {
          solicitanteId,
          atiendeId: null,
          estatusId: 1, // Sin asignar
          empresaId,
          prioridad,
          archivado: false,
          categoriaId: parsedCategoriaId,
          subcategoriaId: parsedSubcategoriaId,
          descripcion: descripcion,
          afectado_clave: afectado_clave || null,
          afectado_nombre: afectado_nombre || null,
        },
      });

      console.warn(`[Ticket ${nuevoTicket.id}] Creado sin asignar (razón: ${assignmentResult.reason})`);
    }

    // Notificar
    const notificationPayload = {
      type: 'ticket_created' as const,
      message: `Se ha creado un nuevo ticket #${nuevoTicket.id}`,
      ticketId: nuevoTicket.id,
      originatorId: String(session.user.id)
    };

    const targetUsers: number[] = [];
    if (atiendeId) {
      targetUsers.push(atiendeId);
    }

    // Si hay agente asignado, notificar solo a él. Si no, broadcast (o lógica futura de admins)
    sendNotification(notificationPayload, targetUsers.length > 0 ? targetUsers : undefined);

    // Enviar correo de notificación al agente de forma asíncrona
    if (atiendeId) {
      (async () => {
        try {
          const [agente, solicitante, categoria] = await Promise.all([
            prisma.usuario.findUnique({
              where: { id: atiendeId },
              select: { nombres: true, apellidos: true, mail: true }
            }),
            prisma.usuario.findUnique({
              where: { id: solicitanteId },
              select: { nombres: true, apellidos: true }
            }),
            prisma.categoria.findUnique({
              where: { id: parsedCategoriaId },
              select: { nombre: true }
            })
          ]);

          if (agente && agente.mail) {
            const originUrl = new URL(request.url).origin;
            const solicitanteNombre = solicitante
              ? `${solicitante.nombres} ${solicitante.apellidos}`
              : "Usuario";
            const agenteNombre = `${agente.nombres} ${agente.apellidos}`;
            const categoriaNombre = categoria?.nombre || "General";

            // Notificar al agente asignado
            await sendTicketNotification({
              ticketId: nuevoTicket.id,
              event: "ticket_creado",
              destinatarioId: atiendeId,
              destinatarioMail: agente.mail,
              originUrl,
              fromName: solicitanteNombre,
              ticketInfo: {
                categoria: categoriaNombre,
                descripcion: descripcion,
                prioridad: prioridad,
                solicitanteNombre,
                agenteNombre,
              }
            });

            // Notificar al creador del ticket
            if (solicitante && solicitante.mail) {
              await sendTicketNotification({
                ticketId: nuevoTicket.id,
                event: "ticket_creado_solicitante",
                destinatarioId: userId,
                destinatarioMail: solicitante.mail,
                originUrl,
                fromName: agenteNombre,
                ticketInfo: {
                  categoria: categoriaNombre,
                  descripcion: descripcion,
                  prioridad: prioridad,
                  solicitanteNombre,
                  agenteNombre,
                }
              });
            }
          }
        } catch (emailErr) {
          console.error('[EmailNotificationError] Error al procesar notificación de ticket creado:', emailErr);
        }
      })();
    }

    return new Response(JSON.stringify(nuevoTicket), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error al crear el ticket:', error);
    return new Response(
      JSON.stringify({ message: 'Error interno del servidor al crear el ticket.' }),
      { status: 500 }
    );
  }
};
