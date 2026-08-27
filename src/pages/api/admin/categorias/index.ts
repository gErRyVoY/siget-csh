import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { invalidateReferenceData } from "@/lib/reference-data";

// Helper to check authentication.
// La sesión la resolvió ya el middleware y vive en `locals.session`; leerla de
// ahí evita volver a ejecutar el handler completo de Auth.js en cada llamada.
function checkAuth(locals: App.Locals) {
    const session = locals.session;
    return session && session.user;
}

// POST: Crear nueva categoría
export const POST: APIRoute = async ({ request, locals }) => {
    if (!checkAuth(locals)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const { nombre } = await request.json();
        if (!nombre || !nombre.trim()) {
            return new Response(JSON.stringify({ error: "El nombre es requerido" }), { status: 400 });
        }

        // Validate characters: letters, accents, dieresis, numbers and spaces
        const nameRegex = /^[A-Za-z0-9áéíóúÁÉÍÓÚüÜñÑ\s]+$/;
        if (!nameRegex.test(nombre)) {
            return new Response(JSON.stringify({ error: "El nombre solo puede contener letras, números y espacios" }), { status: 400 });
        }

        const newCat = await prisma.categoria.create({
            data: {
                nombre: nombre.trim(),
                activo: true
            }
        });

        // El catálogo cacheado (src/lib/reference-data.ts) queda obsoleto.
        invalidateReferenceData();

        return new Response(JSON.stringify(newCat), { status: 201 });
    } catch (error: any) {
        console.error("Error creating category:", error);
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
            return new Response(JSON.stringify({ error: "ID de categoría requerido" }), { status: 400 });
        }

        const catId = parseInt(id, 10);
        const existingCat = await prisma.categoria.findUnique({
            where: { id: catId }
        });

        if (!existingCat) {
            return new Response(JSON.stringify({ error: "Categoría no encontrada" }), { status: 404 });
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
                where: { categoriaId: catId }
            });
            if (ticketsCount > 0 && nombre.trim() !== existingCat.nombre) {
                return new Response(JSON.stringify({ error: "No se puede editar el nombre de la categoría porque tiene tickets registrados" }), { status: 400 });
            }

            updateData.nombre = nombre.trim();
        }

        const updatedCat = await prisma.categoria.update({
            where: { id: catId },
            data: updateData
        });

        invalidateReferenceData();

        return new Response(JSON.stringify(updatedCat), { status: 200 });
    } catch (error: any) {
        console.error("Error updating category:", error);
        return new Response(JSON.stringify({ error: error.message || "Error interno del servidor" }), { status: 500 });
    }
};

// DELETE: Eliminar categoría (solo si no tiene tickets asociados)
export const DELETE: APIRoute = async ({ request, locals }) => {
    if (!checkAuth(locals)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const idParam = url.searchParams.get("id");
        if (!idParam) {
            return new Response(JSON.stringify({ error: "ID de categoría requerido" }), { status: 400 });
        }

        const catId = parseInt(idParam, 10);
        if (isNaN(catId)) {
            return new Response(JSON.stringify({ error: "ID de categoría inválido" }), { status: 400 });
        }

        // 1. Get all subcategories linked to this category
        const subRelations = await prisma.subcategoriaCategorias.findMany({
            where: { categoriaId: catId },
            include: { subcategoria: true }
        });

        const subIds = subRelations.map(r => r.subcategoriaId);

        // Recursive function to gather all nested subcategory IDs
        async function getDescendants(ids: number[]): Promise<number[]> {
            if (ids.length === 0) return [];
            const children = await prisma.subcategoria.findMany({
                where: { parent_subcategoriaId: { in: ids } }
            });
            const childIds = children.map(c => c.id);
            const nestedIds = await getDescendants(childIds);
            return [...childIds, ...nestedIds];
        }

        const descendantIds = await getDescendants(subIds);
        const allAssociatedSubIds = Array.from(new Set([...subIds, ...descendantIds]));

        // 2. Si la categoría tiene subcategorías relacionadas, no permitir la eliminación directa
        if (subIds.length > 0) {
            return new Response(
                JSON.stringify({ error: "No se puede eliminar la categoría porque tiene subcategorías relacionadas. Elimínalas primero." }),
                { status: 400 }
            );
        }

        // 3. Check if category itself has tickets
        const catTickets = await prisma.ticket.count({
            where: { categoriaId: catId }
        });

        // 4. Check if any associated subcategory has tickets
        let subTickets = 0;
        if (allAssociatedSubIds.length > 0) {
            subTickets = await prisma.ticket.count({
                where: { subcategoriaId: { in: allAssociatedSubIds } }
            });
        }

        if (catTickets > 0 || subTickets > 0) {
            return new Response(
                JSON.stringify({ error: "No se puede eliminar la categoría porque tiene tickets registrados" }),
                { status: 400 }
            );
        }

        // 4. Perform deletion of relations and category/subcategories inside a transaction
        await prisma.$transaction(async (tx) => {
            // Delete permissions and assignments for the category and its subcategories
            await tx.permisoCategoria.deleteMany({
                where: {
                    OR: [
                        { categoriaId: catId },
                        { subcategoriaId: { in: allAssociatedSubIds } }
                    ]
                }
            });

            await tx.asignacionesCategorias.deleteMany({
                where: {
                    OR: [
                        { categoriaId: catId },
                        { subcategoriaId: { in: allAssociatedSubIds } }
                    ]
                }
            });

            // Delete relation links
            await tx.subcategoriaCategorias.deleteMany({
                where: { categoriaId: catId }
            });

            // Delete subcategories (delete children first to satisfy self-referencing foreign keys)
            // Sort descendant subcategories or delete them in reverse hierarchical order
            // We can delete level by level
            let levelIds = [...allAssociatedSubIds];
            while (levelIds.length > 0) {
                // Find leaf subcategories (those which are not parents of any other subcategory in levelIds)
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
                    // Fallback to avoid infinite loop (should not happen in normal tree)
                    await tx.subcategoria.deleteMany({ where: { id: { in: levelIds } } });
                    break;
                }

                await tx.subcategoria.deleteMany({
                    where: { id: { in: leaves } }
                });

                levelIds = levelIds.filter(id => parentIdSet.has(id));
            }

            // Finally, delete the category itself
            await tx.categoria.delete({
                where: { id: catId }
            });
        });

        invalidateReferenceData();

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        console.error("Error deleting category:", error);
        return new Response(JSON.stringify({ error: error.message || "Error interno del servidor" }), { status: 500 });
    }
};
