import type { APIRoute } from "astro";
import { getSession } from "auth-astro/server";

export const PATCH: APIRoute = async ({ locals,  request }) => {
  const { db } = locals;
  const session = await getSession(request);
  if (!session || !session.user || !session.user.secciones?.includes("admin_siget_roles")) {
    return new Response(JSON.stringify({ message: "No autorizado" }), {
      status: 401,
    });
  }

  try {
    const data = await request.json();
    const { rolId, activo } = data;
    const adminUserId = parseInt(session.user.id as string, 10);

    if (!rolId) {
      return new Response(JSON.stringify({ message: "Rol no especificado" }), { status: 400 });
    }

    const uid = parseInt(rolId, 10);

    await db.$transaction(async (tx) => {
        await tx.rol.update({
            where: { id: uid },
            data: { activo }
        });

        await tx.logs.create({
            data: {
              accion: `Rol ID ${uid} cambiado a estado ${activo ? 'activo' : 'inactivo'}`,
              detalles: { adminUserId, rolId, activo },
              usuarioId: adminUserId,
            },
        });
    });

    return new Response(JSON.stringify({ message: "Estado de rol actualizado" }), { status: 200 });
  } catch (error: any) {
    console.error("Error setting role active state:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor", details: error.message }),
      { status: 500 },
    );
  }
};
