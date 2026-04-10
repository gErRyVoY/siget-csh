import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
    const { db } = context.locals;
    const [ticketCounts, activeCycle] = await Promise.all([
        db.ticket.groupBy({
            by: ["estatusId"],
            _count: { id: true },
        }),
        db.ciclo.findFirst({ where: { activo: true } }),
    ]);

    const statuses = await db.estatus.findMany();

    const getCount = (name: string) => {
        const status = statuses.find((s) => s.nombre === name);
        if (!status) return 0;
        return (
            ticketCounts.find((c) => c.estatusId === status.id)?._count.id || 0
        );
    };

    const trasladosCount = activeCycle
        ? await db.ticket.count({
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
