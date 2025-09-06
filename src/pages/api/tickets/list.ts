import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

const PRIVILEGED_ROLES = [1, 2, 3, 4, 5, 6, 15];

export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  const url = new URL(request.url);
  const params = url.searchParams;
  const userId = session.user.id;
  const userRolId = session.user.rol?.id ?? -1; // Fallback to a non-privileged ID

  const isPrivileged = PRIVILEGED_ROLES.includes(userRolId);

  try {
    // --- Build a dynamic where clause for filtering ---
    const where: Prisma.TicketWhereInput = {};

    // Default view: Non-privileged users only see their own tickets.
    // Privileged users can see all tickets, but can filter by solicitante if needed.
    if (!isPrivileged) {
      where.solicitanteId = userId;
    } else {
      const solicitanteId = params.get('solicitante');
      if (solicitanteId) {
        where.solicitanteId = parseInt(solicitanteId, 10);
      }
    }

    const estatusId = params.get('estatus');
    if (estatusId && estatusId !== 'all') {
      where.estatusId = parseInt(estatusId, 10);
    }

    const excludeStatuses = params.get('exclude_statuses');
    if (excludeStatuses) {
      const statusNamesToExclude = excludeStatuses.split(',');
      where.estatus = {
        isNot: {
          nombre: {
            in: statusNamesToExclude,
          },
        },
      };
    }

    const categoriaId = params.get('categoria');
    if (categoriaId && categoriaId !== 'all') {
      where.categoriaId = parseInt(categoriaId, 10);
    }

    // Conditional filters for privileged users
    if (isPrivileged) {
      const empresaId = params.get('empresa');
      if (empresaId && empresaId !== 'all') {
        where.empresaId = parseInt(empresaId, 10);
      }

      const atiendeId = params.get('atiende');
      if (atiendeId && atiendeId !== 'all') {
        where.atiendeId = parseInt(atiendeId, 10);
      }
    }

    // --- Pagination ---
    const page = parseInt(params.get('page') || '1', 10);
    const limitParam = params.get('limit');
    const limit = limitParam === 'all' ? undefined : parseInt(limitParam || '10', 10);

    // --- Fetch data ---
    const totalTickets = await prisma.ticket.count({ where });
    const tickets = await prisma.ticket.findMany({
      where,
      skip: limit ? (page - 1) * limit : undefined,
      take: limit,
      orderBy: { fechaalta: 'desc' },
      include: {
        estatus: true,
        categoria: true,
        solicitante: { select: { nombres: true, apellidos: true } },
        atiende: { select: { nombres: true, apellidos: true } },
        empresa: { select: { nombre: true } },
      },
    });

    const totalPages = limit ? Math.ceil(totalTickets / limit) : 1;

    return new Response(JSON.stringify({
      tickets,
      pagination: { page, limit: limit || 'all', totalTickets, totalPages },
    }), { status: 200 });

  } catch (error) {
    console.error('Error fetching tickets:', error);
    return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
  }
};