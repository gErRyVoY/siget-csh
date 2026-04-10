import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';

const PRIVILEGED_ROLES = [1, 2, 3, 4, 5, 6, 15];

export const PATCH: APIRoute = async ({ locals,  request }) => {
  const { db } = locals;
    const session = await getSession(request);
    if (!session || !session.user) {
        return new Response(JSON.stringify({ message: "No autorizado" }), { status: 401 });
    }

    const currentUserId = parseInt(session.user.id as string, 10);
    const userRoleId = session.user.rol?.id ?? -1;

    if (!PRIVILEGED_ROLES.includes(userRoleId)) {
        return new Response(JSON.stringify({ message: "Permisos insuficientes" }), { status: 403 });
    }

    try {
        const data = await request.json();
        const targetUsuarioId = Number(data.usuarioId);
        const { categoriaId, subcategoriaId, activo } = data;

        if (!targetUsuarioId || typeof activo !== 'boolean') {
            return new Response(JSON.stringify({ message: "Datos incompletos o inválidos" }), { status: 400 });
        }

        const catId = categoriaId ? Number(categoriaId) : null;
        const subcatId = subcategoriaId ? Number(subcategoriaId) : null;

        const asignacion = await db.asignacionesCategorias.findFirst({
            where: {
                atiendeId: targetUsuarioId,
                categoriaId: catId,
                subcategoriaId: subcatId
            }
        });

        if (asignacion) {
            await db.asignacionesCategorias.update({
                where: { id: asignacion.id },
                data: { activo }
            });
        } else {
            await db.asignacionesCategorias.create({
                data: {
                    atiendeId: targetUsuarioId,
                    categoriaId: catId,
                    subcategoriaId: subcatId,
                    activo
                }
            });
        }

        await db.logs.create({
            data: {
                accion: `Actualización Permiso Categoría`,
                detalles: { targetUsuarioId, categoriaId: catId, subcategoriaId: subcatId, activo },
                usuarioId: currentUserId
            }
        });

        return new Response(JSON.stringify({ message: "Asignación actualizada correctamente" }), { status: 200 });
    } catch (error: any) {
        console.error("Error setting category assignment:", error);
        return new Response(JSON.stringify({ message: "Error interno del servidor", error: error.message }), { status: 500 });
    }
};
