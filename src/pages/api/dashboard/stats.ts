import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";

export const GET: APIRoute = async () => {
    // ⚡ Phase 1: Run all independent queries in parallel
    const [ticketCounts, activeCycle, statuses, sinAsignarCount] = await Promise.all([
        prisma.ticket.groupBy({ by: ["estatusId"], _count: { id: true } }),
        prisma.ciclo.findFirst({ where: { activo: true } }),
        prisma.estatus.findMany(),
        prisma.ticket.count({ where: { atiendeId: null } }),
    ]);

    const getCount = (name: string) => {
        const status = statuses.find((s) => s.nombre === name);
        if (!status) return 0;
        return (
            ticketCounts.find((c) => c.estatusId === status.id)?._count.id || 0
        );
    };

    // ⚡ Phase 2: trasladosCount depends on activeCycle result
    const trasladosCount = activeCycle
        ? await prisma.ticket.count({
            where: {
                subcategoriaId: 58,
                fechaalta: {
                    gte: activeCycle.fecha_inicio,
                    lte: activeCycle.fecha_fin,
                },
            },
        })
        : 0;

    const total = ticketCounts.reduce((acc, curr) => acc + curr._count.id, 0);

    return new Response(
        JSON.stringify({
            nuevos: getCount("Nuevo"),
            enProgreso: getCount("En progreso"),
            enEspera: getCount("En espera"),
            sinAsignar: sinAsignarCount,
            traslados: trasladosCount,
            total: total,
            solucionados: getCount("Solucionado"),
            duplicados: getCount("Duplicado"),
            cancelados: getCount("Cancelado"),
        }),
        {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        },
    );
};
