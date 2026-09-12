import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { TRASLADO_SUBCATEGORIA_ID } from "@/config/ticket-categories";
import { getEstadoTraslados } from "@/lib/traslados-config";

export const GET: APIRoute = async ({ request, locals }) => {
    const session = locals.session;
    if (!session || !session.user || !session.user.id) {
        return new Response(JSON.stringify({ message: "No autorizado" }), { status: 401 });
    }

    const userId = parseInt(session.user.id as string, 10);
    if (isNaN(userId)) {
        return new Response(JSON.stringify({ message: "ID inválido" }), { status: 400 });
    }

    const [ticketCounts, statuses, estadoTraslados] = await Promise.all([
        prisma.ticket.groupBy({
            by: ["estatusId"],
            where: { atiendeId: userId },
            _count: { id: true },
        }),
        prisma.estatus.findMany(),
        getEstadoTraslados(),
    ]);

    const getCount = (name: string) => {
        const status = statuses.find((s) => s.nombre === name);
        if (!status) return 0;
        return ticketCounts.find((c) => c.estatusId === status.id)?._count.id || 0;
    };

    // El ciclo lo programa /admin/traslados; fuera del periodo la ficha no se
    // pinta, así que se devuelve 0 sin consultar.
    const cicloTraslados = estadoTraslados.periodoAbierto ? estadoTraslados.cicloDestino : null;
    const trasladosCount = cicloTraslados
        ? await prisma.ticket.count({
              where: {
                  atiendeId: userId,
                  subcategoriaId: TRASLADO_SUBCATEGORIA_ID,
                  cicloId: cicloTraslados.id,
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
