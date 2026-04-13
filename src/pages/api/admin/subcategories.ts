import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { getSession } from "auth-astro/server";

export const POST: APIRoute = async ({ request }) => {
    const session = await getSession(request);
    if (!session || !session.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Check permissions? 
    // Assuming Marketing Director or Admin can create.
    // Ideally check 'crear_subcategoria' permission if exists, or Role check.

    try {
        const data = await request.json();
        const { nombre, categoriaId } = data;

        if (!nombre || !categoriaId) {
            return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
        }

        const newSub = await prisma.subcategoria.create({
            data: {
                nombre,
                activo: true,
                // Link to Category via SubcategoriaCategorias relation table?
                // Schema check: 
                // model Subcategoria { ... categorias SubcategoriaCategorias[] }
                // So we need to create the relation too.
                categorias: {
                    create: {
                        categoriaId: parseInt(categoriaId)
                    }
                }
            }
        });

        return new Response(JSON.stringify(newSub), { status: 201 });
    } catch (error) {
        console.error("Error creating subcategory:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
};

export const GET: APIRoute = async ({ request }) => {
    // List logic if needed via API, but normally Astro pages fetch directly.
    return new Response(JSON.stringify({ message: "Use DB direct in Astro" }), { status: 200 });
};
