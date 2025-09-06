import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/db';
import { getSession } from 'auth-astro/server';

/**
 * Finds the best-suited agent based on availability and workload.
 * @returns The ID of the selected agent.
 */
async function findBestAgent(): Promise<number> {
  // 1. Find all available agents
  const availableAgents = await prisma.usuario.findMany({
    where: {
      activo: true,
      vacaciones: false,
    },
  });

  // 3. Fallback Assignment
  if (availableAgents.length === 0) {
    console.warn(`No available agents found. Falling back to default agent ID 1.`);
    return 1; // Fallback agent ID
  }

  // 2. Load Balancing: Sort agents by their current workload
  availableAgents.sort((a, b) => a.carga_actual - b.carga_actual);

  // Return the ID of the agent with the least workload
  return availableAgents[0].id;
}

export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request);

  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  const { io, users } = request as any;

  try {
    const data = await request.json();
    const { categoriaId, subcategoriaId, descripcion } = data;

    if (!categoriaId || !subcategoriaId || !descripcion) {
      return new Response(
        JSON.stringify({ message: 'Faltan campos requeridos.' }),
        { status: 400 }
      );
    }

    // --- Dynamic Ticket Assignment ---
    const atiendeId = await findBestAgent();

    // --- Ticket Creation ---
    const solicitanteId = session.user.id;
    const empresaId = session.user.empresa.id;
    const estatusId = 1; // 1 = "Nuevo"
    const prioridad = 'Baja'; // Default priority

    // Use a transaction to create the ticket and update the agent's workload atomically
    const [nuevoTicket] = await prisma.$transaction([
      prisma.ticket.create({
        data: {
          solicitanteId,
          atiendeId,
          estatusId,
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

    // Notify user
    if (io && users[atiendeId]) {
      io.to(users[atiendeId]).emit('notification', { message: `Se te ha asignado un nuevo ticket #${nuevoTicket.id}` });
    }

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