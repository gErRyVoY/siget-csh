import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';
import { getEstadoTraslados } from '@/lib/traslados-config';

export const GET: APIRoute = async ({ url }) => {
    try {
        const matricula = url.searchParams.get('matricula');

        if (!matricula) {
            return new Response(JSON.stringify({ message: 'Matrícula requerida' }), { status: 400 });
        }

        // 1. Ciclo destino de los traslados (/admin/traslados), el mismo que usa
        //    /api/tickets/transfer para guardar el ticket. Antes se miraba el ciclo
        //    activo, así que el aviso de duplicado y el 409 del alta podían
        //    discrepar en cuanto el periodo apuntaba al ciclo siguiente.
        const { cicloDestino } = await getEstadoTraslados();

        if (!cicloDestino) {
            // Sin ciclo destino no se puede comprobar la unicidad por ciclo. El alta
            // rechaza el traslado igualmente, así que aquí basta con no avisar.
            return new Response(JSON.stringify({ exists: false }), { status: 200 });
        }

        // 2. Check for existing active transfer (Not Cancelled)
        const existingTraslado = await prisma.traslado.findFirst({
            where: {
                matricula: matricula,
                ticket: {
                    cicloId: cicloDestino.id,
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
                estatus: existingTraslado.ticket.estatus.nombre,
                ciclo: cicloDestino.ciclo
            }), { status: 200 });
        }

        return new Response(JSON.stringify({ exists: false }), { status: 200 });

    } catch (error) {
        console.error('Error checking transfer:', error);
        return new Response(JSON.stringify({ message: 'Error checking transfer' }), { status: 500 });
    }
}
