import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { id, activo } = await request.json();

        if (activo) {
            // Activate this one, deactivate others
            await prisma.$transaction([
                prisma.ciclo.updateMany({
                    where: { id: { not: id } },
                    data: { activo: false }
                }),
                prisma.ciclo.update({
                    where: { id },
                    data: { activo: true }
                })
            ]);
        } else {
            // Just deactivate
            await prisma.ciclo.update({
                where: { id },
                data: { activo: false }
            });
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error('Error toggling cycle:', error);
        return new Response(JSON.stringify({ message: 'Error interno' }), { status: 500 });
    }
}
