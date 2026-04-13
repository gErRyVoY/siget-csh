import type { APIRoute } from "astro";
import { getSession } from "auth-astro/server";
import { prisma } from "@/lib/db";

export const PATCH: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ message: "No autorizado" }), { status: 401 });
  }

  const usuarioId = Number(session.user.id);

  try {
    const body = await request.json();
    const { alias, horario_disponibilidad, vacaciones } = body;

    const updateData: Record<string, unknown> = {};

    // Alias: trim, empty string becomes null
    if ("alias" in body) {
      const trimmed = typeof alias === "string" ? alias.trim() : "";
      updateData.alias = trimmed.length > 0 ? trimmed : null;
    }

    // Horario
    if ("horario_disponibilidad" in body) {
      updateData.horario_disponibilidad = horario_disponibilidad ?? null;
    }

    // Vacaciones toggle
    if ("vacaciones" in body && typeof vacaciones === "boolean") {
      updateData.vacaciones = vacaciones;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ message: "Sin cambios" }), { status: 200 });
    }

    const updated = await (prisma.usuario as any).update({
      where: { id: usuarioId },
      data: updateData,
    });

    return new Response(JSON.stringify({ success: true, data: updated }), { status: 200 });
  } catch (err) {
    console.error("[/api/user/profile PATCH]", err);
    return new Response(JSON.stringify({ message: "Error interno del servidor" }), { status: 500 });
  }
};
