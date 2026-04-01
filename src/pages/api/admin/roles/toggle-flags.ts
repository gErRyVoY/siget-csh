import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { getSession } from "auth-astro/server";

// PATCH /api/admin/roles/toggle-flags
// Body: { rolId, field: 'atiendeTicketsCsh' | 'atiendeTicketsMkt', value: boolean }
export const PATCH: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session?.user?.secciones?.includes("admin_roles")) {
    return new Response(JSON.stringify({ message: "No autorizado" }), { status: 401 });
  }

  try {
    const { rolId, field, value } = await request.json();
    const adminUserId = parseInt(session.user.id as string, 10);

    if (!rolId || !field) {
      return new Response(JSON.stringify({ message: "Parámetros inválidos" }), { status: 400 });
    }

    const allowedFields = ["atiendeTicketsCsh", "atiendeTicketsMkt"];
    if (!allowedFields.includes(field)) {
      return new Response(JSON.stringify({ message: "Campo no permitido" }), { status: 400 });
    }

    const uid = parseInt(String(rolId), 10);

    await prisma.$transaction(async (tx) => {
      await tx.rol.update({
        where: { id: uid },
        data: { [field]: Boolean(value) },
      });

      await tx.logs.create({
        data: {
          accion: `Rol ID ${uid}: ${field} establecido a ${value}`,
          detalles: { adminUserId, rolId: uid, field, value },
          usuarioId: adminUserId,
        },
      });
    });

    return new Response(JSON.stringify({ message: "Flag actualizado" }), { status: 200 });
  } catch (error: any) {
    console.error("[/api/admin/roles/toggle-flags PATCH]", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor", details: error.message }),
      { status: 500 }
    );
  }
};
