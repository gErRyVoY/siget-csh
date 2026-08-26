import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";

// Helper to check authentication.
// La sesión la resolvió ya el middleware y vive en `locals.session`; leerla de
// ahí evita volver a ejecutar el handler completo de Auth.js en cada llamada.
function checkAuth(locals: App.Locals) {
    const session = locals.session;
    return session && session.user;
}

// POST: Crear nueva subcategoría
export const POST: APIRoute = async ({ request, locals }) => {
    if (!checkAuth(locals)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const { nombre, categoriaId, parentSubcategoriaId } = await request.json();
        if (!nombre || !nombre.trim()) {
            return new Response(JSON.stringify({ error: "El nombre es requerido" }), { status: 400 });
        }

        // Validate character format: letters, accents, dieresis, numbers and spaces
        const nameRegex = /^[A-Za-z0-9áéíóúÁÉÍÓÚüÜñÑ\s]+$/;
        if (!nameRegex.test(nombre)) {
            return new Response(JSON.stringify({ error: "El nombre solo puede contener letras, números y espacios" }), { status: 400 });
        }

        // Resolve which category this subcategory belongs to
        let resolvedCategoriaId = categoriaId ? parseInt(categoriaId, 10) : null;
        const parsedParentId = parentSubcategoriaId ? parseInt(parentSubcategoriaId, 10) : null;

        if (parsedParentId) {
            // Find parent's category from SubcategoriaCategorias
            const parentRel = await prisma.subcategoriaCategorias.findFirst({
                where: { subcategoriaId: parsedParentId }
            });
            if (parentRel) {
                resolvedCategoriaId = parentRel.categoriaId;
            }
        }

        if (!resolvedCategoriaId) {
            return new Response(JSON.stringify({ error: "No se pudo determinar la categoría principal" }), { status: 400 });
        }

        // Create Subcategoria and its mapping inside a transaction
        const newSub = await prisma.$transaction(async (tx) => {
            const sub = await tx.subcategoria.create({
                data: {
                    nombre: nombre.trim(),
                    parent_subcategoriaId: parsedParentId,
                    activo: true
                }
            });

            await tx.subcategoriaCategorias.create({
                data: {
                    categoriaId: resolvedCategoriaId!,
                    subcategoriaId: sub.id,
                    activo: true
                }
            });

            return sub;
        });

        return new Response(JSON.stringify(newSub), { status: 201 });
    } catch (error: any) {
        console.error("Error creating subcategory:", error);
        return new Response(JSON.stringify({ error: error.message || "Error interno del servidor" }), { status: 500 });
    }
};

// PATCH: Editar nombre o alternar estado activo
export const PATCH: APIRoute = async ({ request, locals }) => {
    if (!checkAuth(locals)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const { id, nombre, activo } = await request.json();
        if (!id) {
            return new Response(JSON.stringify({ error: "ID de subcategoría requerido" }), { status: 400 });
        }

        const subId = parseInt(id, 10);
        const existingSub = await prisma.subcategoria.findUnique({
            where: { id: subId }
        });

        if (!existingSub) {
            return new Response(JSON.stringify({ error: "Subcategoría no encontrada" }), { status: 404 });
        }

        const updateData: any = {};

        if (activo !== undefined) {
            updateData.activo = !!activo;
        }

        if (nombre !== undefined) {
            if (!nombre.trim()) {
                return new Response(JSON.stringify({ error: "El nombre no puede estar vacío" }), { status: 400 });
            }
            const nameRegex = /^[A-Za-z0-9áéíóúÁÉÍÓÚüÜñÑ\s]+$/;
            if (!nameRegex.test(nombre)) {
                return new Response(JSON.stringify({ error: "El nombre solo puede contener letras, números y espacios" }), { status: 400 });
            }

            // Check if there are tickets before changing name
            const ticketsCount = await prisma.ticket.count({
                where: { subcategoriaId: subId }
            });
            if (ticketsCount > 0 && nombre.trim() !== existingSub.nombre) {
                return new Response(JSON.stringify({ error: "No se puede editar el nombre de la subcategoría porque tiene tickets registrados" }), { status: 400 });
            }

            updateData.nombre = nombre.trim();
        }

        const updatedSub = await prisma.subcategoria.update({
            where: { id: subId },
            data: updateData
        });

        return new Response(JSON.stringify(updatedSub), { status: 200 });
    } catch (error: any) {
        console.error("Error updating subcategory:", error);
        return new Response(JSON.stringify({ error: error.message || "Error interno del servidor" }), { status: 500 });
    }
};

// DELETE: Eliminar subcategoría (solo si no tiene tickets asociados)
export const DELETE: APIRoute = async ({ request, locals }) => {
    if (!checkAuth(locals)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const idParam = url.searchParams.get("id");
        if (!idParam) {
            return new Response(JSON.stringify({ error: "ID de subcategoría requerido" }), { status: 400 });
        }

        const subId = parseInt(idParam, 10);
        if (isNaN(subId)) {
            return new Response(JSON.stringify({ error: "ID de subcategoría inválido" }), { status: 400 });
        }

        // Recursive function to gather all descendant IDs
        async function getDescendants(ids: number[]): Promise<number[]> {
            if (ids.length === 0) return [];
            const children = await prisma.subcategoria.findMany({
                where: { parent_subcategoriaId: { in: ids } }
            });
            const childIds = children.map(c => c.id);
            const nestedIds = await getDescendants(childIds);
            return [...childIds, ...nestedIds];
        }

        const descendantIds = await getDescendants([subId]);
        const allAssociatedSubIds = Array.from(new Set([subId, ...descendantIds]));

        // Check if this subcategory has direct children (no se puede eliminar si tiene subcategorías hijas)
        const directChildrenCount = await prisma.subcategoria.count({
            where: { parent_subcategoriaId: subId }
        });
        if (directChildrenCount > 0) {
            return new Response(
                JSON.stringify({ error: "No se puede eliminar la subcategoría porque tiene subcategorías relacionadas. Elimínalas primero." }),
                { status: 400 }
            );
        }

        // Check if any of these subcategories has tickets
        const subTickets = await prisma.ticket.count({
            where: { subcategoriaId: { in: allAssociatedSubIds } }
        });

        if (subTickets > 0) {
            return new Response(
                JSON.stringify({ error: "No se puede eliminar la subcategoría porque tiene tickets registrados" }),
                { status: 400 }
            );
        }

        // Perform deletion inside a transaction
        await prisma.$transaction(async (tx) => {
            // Delete permissions and assignments
            await tx.permisoCategoria.deleteMany({
                where: { subcategoriaId: { in: allAssociatedSubIds } }
            });

            await tx.asignacionesCategorias.deleteMany({
                where: { subcategoriaId: { in: allAssociatedSubIds } }
            });

            // Delete relation links
            await tx.subcategoriaCategorias.deleteMany({
                where: { subcategoriaId: { in: allAssociatedSubIds } }
            });

            // Delete subcategories (leaf to root order to prevent key constraint errors)
            let levelIds = [...allAssociatedSubIds];
            while (levelIds.length > 0) {
                const parents = await tx.subcategoria.findMany({
                    where: {
                        id: { in: levelIds },
                        subcategorias: { some: { id: { in: levelIds } } }
                    },
                    select: { id: true }
                });
                const parentIdSet = new Set(parents.map(p => p.id));
                const leaves = levelIds.filter(id => !parentIdSet.has(id));

                if (leaves.length === 0) {
                    await tx.subcategoria.deleteMany({ where: { id: { in: levelIds } } });
                    break;
                }

                await tx.subcategoria.deleteMany({
                    where: { id: { in: leaves } }
                });

                levelIds = levelIds.filter(id => parentIdSet.has(id));
            }
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        console.error("Error deleting subcategory:", error);
        return new Response(JSON.stringify({ error: error.message || "Error interno del servidor" }), { status: 500 });
    }
};
