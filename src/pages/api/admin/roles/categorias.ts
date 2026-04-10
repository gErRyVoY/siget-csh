import type { APIRoute } from "astro";
import { getSession } from "auth-astro/server";

export const PATCH: APIRoute = async ({ locals,  request }) => {
  const { db } = locals;
  const session = await getSession(request);
  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: "No autorizado" }), {
      status: 401,
    });
  }

  try {
    const data = await request.json();
    const { rolId, categoriaId, subcategoriaId, activo } = data;
    const adminUserId = parseInt(session.user.id as string, 10);

    if (!rolId || !categoriaId || typeof activo !== "boolean") {
      return new Response(
        JSON.stringify({ message: "Faltan parámetros o son inválidos." }),
        { status: 400 },
      );
    }

    const subIdParse = subcategoriaId ? parseInt(subcategoriaId, 10) : null;

    const result = await db.$transaction(async (tx) => {
      const permiso = await tx.permisoCategoria.findFirst({
        where: { 
            rolId: parseInt(rolId, 10), 
            categoriaId: parseInt(categoriaId, 10),
            subcategoriaId: subIdParse 
        },
      });

      let updatedPermiso;
      if (permiso) {
        updatedPermiso = await tx.permisoCategoria.update({
          where: { id: permiso.id },
          data: { activo },
        });
      } else {
        updatedPermiso = await tx.permisoCategoria.create({
          data: {
            rolId: parseInt(rolId, 10),
            categoriaId: parseInt(categoriaId, 10),
            subcategoriaId: subIdParse,
            activo,
          },
        });
      }

      await tx.logs.create({
        data: {
          accion: `Modificación permiso categoría ROL`,
          detalles: {
            adminUserId,
            rolId,
            categoriaId,
            subcategoriaId: subIdParse,
            old: permiso ? permiso.activo : null,
            new: activo,
          },
          usuarioId: adminUserId,
        },
      });
      return updatedPermiso;
    });

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error: any) {
    console.error("Error patching role category:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor" }),
      { status: 500 },
    );
  }
};
