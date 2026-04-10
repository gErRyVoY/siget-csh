import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ locals,  request }) => {
  const { db } = locals;
    try {
        const { id, activo } = await request.json();

        if (activo) {
            // Activate this one, deactivate others
            await db.$transaction([
                db.ciclo.updateMany({
                    where: { id: { not: id } },
                    data: { activo: false }
                }),
                db.ciclo.update({
                    where: { id },
                    data: { activo: true }
                })
            ]);
        } else {
            // Just deactivate
            await db.ciclo.update({
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
