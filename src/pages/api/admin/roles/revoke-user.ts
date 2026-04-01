import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { getSession } from "auth-astro/server";

export const PATCH: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session || !session.user || !session.user.secciones?.includes("admin_roles")) {
    return new Response(JSON.stringify({ message: "No autorizado" }), {
      status: 401,
    });
  }

  try {
    const data = await request.json();
    const { usuarioId } = data;
    const adminUserId = parseInt(session.user.id as string, 10);

    if (!usuarioId) {
      return new Response(JSON.stringify({ message: "Usuario no especificado" }), { status: 400 });
    }

    const uid = parseInt(usuarioId, 10);

    await prisma.$transaction(async (tx) => {
        // Find Visitante role
        const visitanteRole = await tx.rol.findFirst({ 
            where: { rol: { equals: "Visitante", mode: "insensitive" } } 
        });

        if (!visitanteRole) {
            throw new Error("El rol 'Visitante' no existe en el sistema. Asegúrate de que el Seed lo haya creado.");
        }

        const currentUsuario = await tx.usuario.findUnique({
             where: { id: uid },
             select: { rolId: true }
        });

        if (!currentUsuario) {
             throw new Error("Usuario no encontrado");
        }

        const prevRolId = currentUsuario.rolId;

        if (prevRolId === visitanteRole.id) {
             throw new Error("El usuario ya es Visitante.");
        }

        // Change role and purge specifically assigned permissions/exceptions!
        await tx.usuario.update({
            where: { id: uid },
            data: { 
                rolId: visitanteRole.id,
                permisos_seccion: { deleteMany: {} },
                asignaciones_categorias: { deleteMany: {} }
            }
        });

        await tx.logs.create({
            data: {
              accion: `Se revocó rol (era ${prevRolId}) al usuario ${uid}, asignando Visitante (ID ${visitanteRole.id}) y limpiando sus excepciones.`,
              detalles: { adminUserId, targetUser: uid, prevRolId, newRolId: visitanteRole.id },
              usuarioId: adminUserId,
            },
        });
    });

    return new Response(JSON.stringify({ message: "Rol revocado exitosamente" }), { status: 200 });
  } catch (error: any) {
    console.error("Error revoking role:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor", details: error.message }),
      { status: 500 },
    );
  }
};
