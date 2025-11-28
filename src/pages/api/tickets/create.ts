import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { prisma } from '../../../lib/db';
import { sendNotification } from '../notifications';
import { findBestAgentHybrid } from '../../../services/ticketAssignmentService';

export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request);

  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  try {
    const data = await request.json();
    const { categoriaId, subcategoriaId, descripcion } = data;
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
    const prioridad = 'Baja';

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
        },
      });

      console.warn(`[Ticket ${nuevoTicket.id}] Creado sin asignar (razón: ${assignmentResult.reason})`);
    }

    // Notificar
    sendNotification({
      message: `Se ha creado un nuevo ticket #${nuevoTicket.id}`,
      originatorId: String(session.user.id)
    });

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
