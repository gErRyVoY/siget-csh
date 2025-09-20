import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/db';
import { getSession } from 'auth-astro/server';
import { sendNotification } from '../notifications';

const ESTATUS_NUEVO = 1;
const ESTATUS_SIN_ASIGNAR = 11;

/**
 * Finds the best-suited agent based on availability and workload, excluding the requester.
 * @param solicitanteId The ID of the user creating the ticket, to exclude from assignment.
 * @returns The ID of the selected agent, or null if no suitable agent is found.
 */
async function findBestAgent(solicitanteId: number): Promise<number | null> {
  // Find all available agents who are not the person creating the ticket
  const availableAgents = await prisma.usuario.findMany({
    where: {
      id: {
        not: solicitanteId, // Exclude the requester
      },
      activo: true,
      vacaciones: false,
      // TODO: Add role/permission check here in the future
    },
  });

  // If no agents are available, return null
  if (availableAgents.length === 0) {
    console.warn(`No available agents found (excluding solicitante ${solicitanteId}).`);
    return null;
  }

  // Load Balancing: Sort agents by their current workload
  availableAgents.sort((a, b) => a.carga_actual - b.carga_actual);

  // Return the ID of the agent with the least workload
  return availableAgents[0].id;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const session = await getSession(request);

  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  try {
    const data = await request.json();
    const { categoriaId, subcategoriaId, descripcion } = data;

    if (!categoriaId || !subcategoriaId || !descripcion) {
      return new Response(
        JSON.stringify({ message: 'Faltan campos requeridos.' }),
        { status: 400 }
      );
    }

    const solicitanteId = session.user.id;

    // --- Dynamic Ticket Assignment ---
    const atiendeId = await findBestAgent(solicitanteId);

    // --- Ticket Creation ---
    const empresaId = session.user.empresa.id;
    const prioridad = 'Baja'; // Default priority

    let nuevoTicket;

    if (atiendeId) {
      // Agent found, create ticket and update workload in a transaction
      [nuevoTicket] = await prisma.$transaction([
        prisma.ticket.create({
          data: {
            solicitanteId,
            atiendeId,
            estatusId: ESTATUS_NUEVO,
            empresaId,
            prioridad,
            archivado: false,
            categoriaId: parseInt(categoriaId, 10),
            subcategoriaId: parseInt(subcategoriaId, 10),
            descripcion: descripcion,
          },
        }),
        prisma.usuario.update({
          where: { id: atiendeId },
          data: { carga_actual: { increment: 1 } },
        }),
      ]);
    } else {
      // No agent found, create ticket as "Sin asignar"
      nuevoTicket = await prisma.ticket.create({
        data: {
          solicitanteId,
          atiendeId: null, // No agent assigned
          estatusId: ESTATUS_SIN_ASIGNAR,
          empresaId,
          prioridad,
          archivado: false,
          categoriaId: parseInt(categoriaId, 10),
          subcategoriaId: parseInt(subcategoriaId, 10),
          descripcion: descripcion,
        },
      });
    }

    // Notify user
    sendNotification({ 
        message: `Se ha creado un nuevo ticket #${nuevoTicket.id}`,
        originatorId: session.user.id
    });

    return new Response(JSON.stringify(nuevoTicket), {
      status: 201, // 201 Created
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