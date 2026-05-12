import type { APIRoute } from "astro";
import { getSession } from "auth-astro/server";
import { prisma } from "@/lib/db";

export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request);
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

export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request);
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
    // Assuming we want to filter by year, we can filter by fecha >= startOfYear and fecha <= endOfYear,
    // or just fetch all for the user and month, then filter. Let's just fetch for the month.
    
    const incidencias = await prisma.incidencia.findMany({
      where: whereClause,
      orderBy: { fecha: 'desc' }
    });

    // filter by anio if provided
    const filtered = anio > 0 ? incidencias.filter(i => i.fecha && i.fecha.getFullYear() === anio) : incidencias;

    return new Response(JSON.stringify({ status: "ok", data: filtered }), {
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
