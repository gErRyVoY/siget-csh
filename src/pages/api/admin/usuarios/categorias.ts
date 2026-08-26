import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';

const PRIVILEGED_ROLES = [2, 3]; // admin y superadmin

/**
 * Obtiene recursivamente todos los IDs de subcategorías descendientes de una subcategoría dada.
 */
async function getAllDescendantSubcategoryIds(parentSubId: number): Promise<number[]> {
    const directChildren = await prisma.subcategoria.findMany({
        where: { parent_subcategoriaId: parentSubId, activo: true },
        select: { id: true }
    });
    let descendantIds: number[] = directChildren.map(c => c.id);
    for (const child of directChildren) {
        const childDescendants = await getAllDescendantSubcategoryIds(child.id);
        descendantIds = descendantIds.concat(childDescendants);
    }
    return descendantIds;
}

/**
 * Obtiene todos los IDs de subcategorías pertenecientes a una categoría principal.
 */
async function getAllSubcategoryIdsForCategory(catId: number): Promise<number[]> {
    const catRelations = await prisma.subcategoriaCategorias.findMany({
        where: { categoriaId: catId, activo: true },
        select: { subcategoriaId: true }
    });
    let subIds: number[] = catRelations.map(r => r.subcategoriaId);
    for (const subId of [...subIds]) {
        const descendants = await getAllDescendantSubcategoryIds(subId);
        subIds = subIds.concat(descendants);
    }
    return Array.from(new Set(subIds));
}

export const PATCH: APIRoute = async ({ request, locals }) => {
    const session = locals.session;
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

        // Lista de pares (categoriaId, subcategoriaId) a actualizar
        const itemsToUpdate: { categoriaId: number | null; subcategoriaId: number | null }[] = [
            { categoriaId: catId, subcategoriaId: subcatId }
        ];

        if (subcatId) {
            // Si es una subcategoría, encontrar todas sus subcategorías hijas descendientes
            const descendantSubIds = await getAllDescendantSubcategoryIds(subcatId);
            for (const descSubId of descendantSubIds) {
                itemsToUpdate.push({ categoriaId: catId, subcategoriaId: descSubId });
            }
        } else if (catId) {
            // Si es la categoría principal, encontrar todas sus subcategorías
            const allSubIds = await getAllSubcategoryIdsForCategory(catId);
            for (const sId of allSubIds) {
                itemsToUpdate.push({ categoriaId: catId, subcategoriaId: sId });
            }
        }

        // Ejecutar upserts para cada item
        for (const item of itemsToUpdate) {
            const asignacion = await prisma.asignacionesCategorias.findFirst({
                where: {
                    atiendeId: targetUsuarioId,
                    categoriaId: item.categoriaId,
                    subcategoriaId: item.subcategoriaId
                }
            });

            if (asignacion) {
                await prisma.asignacionesCategorias.update({
                    where: { id: asignacion.id },
                    data: { activo }
                });
            } else {
                await prisma.asignacionesCategorias.create({
                    data: {
                        atiendeId: targetUsuarioId,
                        categoriaId: item.categoriaId,
                        subcategoriaId: item.subcategoriaId,
                        activo
                    }
                });
            }
        }

        await prisma.logs.create({
            data: {
                accion: `Actualización Permiso Categoría`,
                detalles: { targetUsuarioId, categoriaId: catId, subcategoriaId: subcatId, activo, totalItems: itemsToUpdate.length },
                usuarioId: currentUserId
            }
        });

        return new Response(JSON.stringify({ message: "Asignación actualizada correctamente" }), { status: 200 });
    } catch (error: any) {
        console.error("Error setting category assignment:", error);
        return new Response(JSON.stringify({ message: "Error interno del servidor", error: error.message }), { status: 500 });
    }
};
