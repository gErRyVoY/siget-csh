import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals,  url }) => {
  const { db } = locals;
    try {
        const matricula = url.searchParams.get('matricula');

        if (!matricula) {
            return new Response(JSON.stringify({ message: 'Matrícula requerida' }), { status: 400 });
        }

        // 1. Get Active Cycle
        const activeCycle = await db.ciclo.findFirst({
            where: { activo: true }
        });

        if (!activeCycle) {
            // If no cycle is active, we can't really enforce cycle-based uniqueness safely.
            // Returning false implies no conflict found.
            return new Response(JSON.stringify({ exists: false }), { status: 200 });
        }

        // 2. Check for existing active transfer (Not Cancelled)
        const existingTraslado = await db.traslado.findFirst({
            where: {
                matricula: matricula,
                ticket: {
                    cicloId: activeCycle.id,
                    estatus: {
                        nombre: { not: 'Cancelado' }
                    }
                }
            },
            include: {
                ticket: {
                    select: {
                        id: true,
                        estatus: { select: { nombre: true } }
                    }
                }
            }
        });

        if (existingTraslado) {
            return new Response(JSON.stringify({
                exists: true,
                ticketId: existingTraslado.ticket.id,
                estatus: existingTraslado.ticket.estatus.nombre
            }), { status: 200 });
        }

        return new Response(JSON.stringify({ exists: false }), { status: 200 });

    } catch (error) {
        console.error('Error checking transfer:', error);
        return new Response(JSON.stringify({ message: 'Error checking transfer' }), { status: 500 });
    }
}
