import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";

export const PATCH: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ message: "No autorizado" }), { status: 401 });
  }

  const usuarioId = Number(session.user.id);

  try {
    const body = await request.json();
    const { alias, horario_disponibilidad, acepta_tickets } = body;

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

    // Toggle acepta_tickets (asignación de tickets)
    if ("acepta_tickets" in body && typeof acepta_tickets === "boolean") {
      updateData.acepta_tickets = acepta_tickets;
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
