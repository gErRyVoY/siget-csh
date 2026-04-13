import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { getSession } from "auth-astro/server";

export const GET: APIRoute = async ({ request }) => {
    const session = await getSession(request);
    if (!session || !session.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
        });
    }

    const MARKETING_CATEGORY_ID = 12;

    try {
        const ticketCounts = await prisma.ticket.groupBy({
            by: ["estatusId"],
            _count: { id: true },
            where: {
                categoriaId: MARKETING_CATEGORY_ID
            }
        });

        // Map counts
        const getCount = (name: string) => {
            // Needed statuses map. Ideally fetch IDs or hardcode if known.
            // Better to fetch statuses to map names to IDs or vice versa if we use Names in UI.
            // But here we return keys matching the Dashboard UI expected keys.
            return 0; // Logic below
        };

        const statuses = await prisma.estatus.findMany();

        const counts: Record<string, number> = {
            nuevos: 0,
            enProgreso: 0,
            enEspera: 0,
            solucionados: 0,
            duplicados: 0,
            cancelados: 0,
            total: 0
        };

        let total = 0;

        ticketCounts.forEach((group) => {
            const statusName = statuses.find(s => s.id === group.estatusId)?.nombre;
            const count = group._count.id;
            total += count;

            if (statusName === "Nuevo") counts.nuevos = count;
            else if (statusName === "En progreso") counts.enProgreso = count;
            else if (statusName === "En espera") counts.enEspera = count;
            else if (statusName === "Solucionado") counts.solucionados = count;
            else if (statusName === "Duplicado") counts.duplicados = count;
            else if (statusName === "Cancelado") counts.cancelados = count;
        });

        counts.total = total;

        return new Response(JSON.stringify(counts), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        console.error("Error fetching marketing dashboard stats:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
        });
    }
};
