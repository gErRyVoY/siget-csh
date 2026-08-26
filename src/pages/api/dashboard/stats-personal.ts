import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";

export const GET: APIRoute = async ({ request, locals }) => {
    const session = locals.session;
    if (!session || !session.user || !session.user.id) {
        return new Response(JSON.stringify({ message: "No autorizado" }), { status: 401 });
    }

    const userId = parseInt(session.user.id as string, 10);
    if (isNaN(userId)) {
        return new Response(JSON.stringify({ message: "ID inválido" }), { status: 400 });
    }

    const [ticketCounts, statuses, activeCycle] = await Promise.all([
        prisma.ticket.groupBy({
            by: ["estatusId"],
            where: { atiendeId: userId },
            _count: { id: true },
        }),
        prisma.estatus.findMany(),
        prisma.ciclo.findFirst({ where: { activo: true } }),
    ]);

    const getCount = (name: string) => {
        const status = statuses.find((s) => s.nombre === name);
        if (!status) return 0;
        return ticketCounts.find((c) => c.estatusId === status.id)?._count.id || 0;
    };

    const trasladosCount = activeCycle
        ? await prisma.ticket.count({
              where: {
                  atiendeId: userId,
                  subcategoriaId: 58,
                  fechaalta: {
                      gte: activeCycle.fecha_inicio,
                      lte: activeCycle.fecha_fin,
                  },
              },
          })
        : 0;

    const total = ticketCounts.reduce((acc, curr) => acc + curr._count.id, 0);

    // Últimos 5 tickets asignados con detalle
    const recentTickets = await prisma.ticket.findMany({
        where: {
            atiendeId: userId,
            estatus: { nombre: { in: ["Nuevo", "En progreso", "En espera"] } },
        },
        orderBy: { fechaalta: "desc" },
        take: 5,
        include: {
            estatus: { select: { nombre: true } },
            empresa: { select: { nombre: true } },
            categoria: { select: { nombre: true } },
            solicitante: { select: { nombres: true, apellidos: true } },
        },
    });

    return new Response(
        JSON.stringify({
            nuevos: getCount("Nuevo"),
            enProgreso: getCount("En progreso"),
            enEspera: getCount("En espera"),
            traslados: trasladosCount,
            total,
            solucionados: getCount("Solucionado"),
            duplicados: getCount("Duplicado"),
            cancelados: getCount("Cancelado"),
            recentTickets,
        }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" },
        },
    );
};
