import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";

export const POST: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
  if (!session || !session.user) {
    return new Response(JSON.stringify({ message: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = Number(session.user.id);

  try {
    const { incidencias } = await request.json();

    if (!Array.isArray(incidencias) || incidencias.length === 0) {
      return new Response(
        JSON.stringify({ message: "No hay incidencias para guardar" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Prepare data for insertion
    const dataToInsert = incidencias.map((inc: any) => ({
      usuarioId: userId,
      mes: inc.mes,
      quincena: inc.quincena,
      fecha: new Date(inc.fecha),
      entrada_turno: inc.entrada_turno || null,
      salida_turno: inc.salida_turno || null,
      tiempo_turno: inc.tiempo_turno || null,
      observaciones: inc.observaciones || null,
      entrada_comida: inc.entrada_comida || null,
      salida_comida: inc.salida_comida || null,
      observaciones_comida: inc.observaciones_comida || null,
      omitida: !!inc.omitida,
    }));

    // Prevent duplicates by deleting existing records for the same dates
    const fechas = dataToInsert.map(d => d.fecha);
    await prisma.incidencia.deleteMany({
      where: {
        usuarioId: userId,
        fecha: { in: fechas }
      }
    });

    // Create many records
    await prisma.incidencia.createMany({
      data: dataToInsert,
    });

    return new Response(JSON.stringify({ message: "Incidencias guardadas" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error al guardar incidencias:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const GET: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
  if (!session || !session.user) {
    return new Response(JSON.stringify({ message: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = Number(session.user.id);
  const url = new URL(request.url);
  const mes = parseInt(url.searchParams.get("mes") || "0");
  const anio = parseInt(url.searchParams.get("anio") || "0");

  try {
    let whereClause: any = { usuarioId: userId };
    if (mes > 0) whereClause.mes = mes;
    // El año se filtra en SQL como rango sobre `fecha`. Antes se traían todas las
    // incidencias del usuario y se descartaban en JavaScript con `.filter()`.
    // Los límites se construyen en la zona horaria del proceso, igual que hacía
    // `fecha.getFullYear()`, para no alterar qué filas entran en el rango.
    if (anio > 0) {
      whereClause.fecha = {
        gte: new Date(anio, 0, 1, 0, 0, 0, 0),
        lt: new Date(anio + 1, 0, 1, 0, 0, 0, 0),
      };
    }

    const incidencias = await prisma.incidencia.findMany({
      where: whereClause,
      orderBy: { fecha: 'desc' }
    });

    return new Response(JSON.stringify({ status: "ok", data: incidencias }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error al obtener incidencias:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
