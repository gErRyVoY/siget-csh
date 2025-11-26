import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/db';
import { getSession } from 'auth-astro/server';
import { sendNotification } from '../notifications';
import { NivelSoporte, type Usuario, type Rol } from '@prisma/client';

const ESTATUS_NUEVO = 2; // Cambio: ID 2 es 'Nuevo' y asignado
const ESTATUS_SIN_ASIGNAR = 1;
const MARKETING_CATEGORY_ID = 12;

/**
 * Finds the best-suited agent based on category, availability, schedule, and workload.
 * @param solicitanteId The ID of the user creating the ticket.
 * @param categoriaId The ID of the ticket's category.
 * @returns The ID of the selected agent, or null if no suitable agent is found.
 */
async function findBestAgent(solicitanteId: number, categoriaId: number): Promise<number | null> {
  const baseQueryConditions = {
    id: { not: solicitanteId },
    activo: true,
    vacaciones: false,
  };

  type AgentWithRelations = Usuario & { rol: Rol };
  let potentialAgents: AgentWithRelations[] = [];

  if (categoriaId === MARKETING_CATEGORY_ID) {
    potentialAgents = await prisma.usuario.findMany({
      where: {
        ...baseQueryConditions,
        rol: { nivel_soporte: NivelSoporte.Marketing },
      },
      include: { rol: true },
    });
  } else {
    const supportLevels = [NivelSoporte.S_1, NivelSoporte.S_2, NivelSoporte.S_3];
    potentialAgents = await prisma.usuario.findMany({
      where: {
        ...baseQueryConditions,
        rol: { nivel_soporte: { in: supportLevels } },
      },
      include: { rol: true },
    });

    if (potentialAgents.length === 0) {
      potentialAgents = await prisma.usuario.findMany({
        where: {
          ...baseQueryConditions,
          rol: { nivel_soporte: NivelSoporte.Desarrollador },
        },
        include: { rol: true },
      });
    }
  }

  if (potentialAgents.length === 0) {
    console.warn(`No potential agents found for categoria ${categoriaId} (excluding solicitante ${solicitanteId}).`);
    return null;
  }

  // --- Schedule-based Filtering ---
  const now = new Date();
  // Get day name in Spanish (e.g., 'lunes', 'miércoles') and remove accents for matching
  const dayOfWeekName = now.toLocaleString('es-MX', { weekday: 'long', timeZone: 'America/Mexico_City' })
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const currentTime = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' });

  const availableAgents = potentialAgents.filter(agent => {
    if (!agent.horario_disponibilidad || typeof agent.horario_disponibilidad !== 'object') {
      return false; // Not available if no schedule is set
    }

    const schedule = agent.horario_disponibilidad as any;
    const daySchedule = schedule[dayOfWeekName];

    if (!daySchedule || !daySchedule.inicio || !daySchedule.fin) {
      return false; // Not available if no schedule for today
    }

    return currentTime >= daySchedule.inicio && currentTime <= daySchedule.fin;
  });

  if (availableAgents.length === 0) {
    console.warn(`No agents are currently on schedule for categoria ${categoriaId}.`);
    return null;
  }

  // Load Balancing: Sort available agents by their current workload
  availableAgents.sort((a, b) => a.carga_actual - b.carga_actual);

  return availableAgents[0].id;
}

export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request);

  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  try {
    const data = await request.json();
    const { categoriaId, subcategoriaId, descripcion } = data;
    const parsedCategoriaId = parseInt(categoriaId, 10);

    if (isNaN(parsedCategoriaId) || !subcategoriaId || !descripcion) {
      return new Response(
        JSON.stringify({ message: 'Faltan campos requeridos o son inválidos.' }),
        { status: 400 }
      );
    }

    const solicitanteId = parseInt(session.user.id as string, 10);

    if (isNaN(solicitanteId)) {
      return new Response(JSON.stringify({ message: 'ID de usuario inválido en la sesión.' }), { status: 400 });
    }

    // --- Dynamic Ticket Assignment ---
    const atiendeId = await findBestAgent(solicitanteId, parsedCategoriaId);

    // --- Ticket Creation ---
    if (!session.user.empresa) {
      return new Response(
        JSON.stringify({ message: 'La información de la empresa no se encontró en la sesión.' }),
        { status: 400 }
      );
    }
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
            categoriaId: parsedCategoriaId,
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
          categoriaId: parsedCategoriaId,
          subcategoriaId: parseInt(subcategoriaId, 10),
          descripcion: descripcion,
        },
      });
    }

    // Notify users
    const notificationPayload: any = {
      type: 'ticket_created',
      message: `Se ha creado un nuevo ticket #${nuevoTicket.id}`,
      ticketId: nuevoTicket.id,
      originatorId: String(session.user.id)
    };

    const targetUsers = atiendeId ? [atiendeId] : []; // If assigned, notify agent. If not, maybe notify admins? (Future improvement)

    sendNotification(notificationPayload, targetUsers);

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
