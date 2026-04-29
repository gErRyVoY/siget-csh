import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { getSession } from "auth-astro/server";

export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request);

  if (!session?.user) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || "";

  if (query.length < 3) {
    return new Response(JSON.stringify({ usuarios: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const usuarios = await prisma.usuario.findMany({
      where: {
        OR: [
          { nombres: { contains: query, mode: "insensitive" } },
          { apellidos: { contains: query, mode: "insensitive" } },
          { mail: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 10,
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        mail: true,
        empresa: {
          select: { nombre: true },
        },
      },
    });

    return new Response(JSON.stringify({ usuarios }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error buscando usuarios:", error);
    return new Response(JSON.stringify({ error: "Error en el servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
