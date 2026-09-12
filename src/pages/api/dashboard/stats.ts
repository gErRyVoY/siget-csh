import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { TRASLADO_SUBCATEGORIA_ID } from "@/config/ticket-categories";
import { getEstadoTraslados } from "@/lib/traslados-config";

export const GET: APIRoute = async () => {
    // ⚡ Phase 1: Run all independent queries in parallel
    const [ticketCounts, estadoTraslados, statuses, sinAsignarCount] = await Promise.all([
        prisma.ticket.groupBy({ by: ["estatusId"], _count: { id: true } }),
        getEstadoTraslados(),
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

    // ⚡ Phase 2: el conteo depende del ciclo destino que programa
    // /admin/traslados. Fuera del periodo la ficha no se pinta, así que se
    // devuelve 0 sin consultar (mismo criterio que src/pages/index.astro).
    const cicloTraslados = estadoTraslados.periodoAbierto ? estadoTraslados.cicloDestino : null;
    const trasladosCount = cicloTraslados
        ? await prisma.ticket.count({
            where: {
                subcategoriaId: TRASLADO_SUBCATEGORIA_ID,
                cicloId: cicloTraslados.id,
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
