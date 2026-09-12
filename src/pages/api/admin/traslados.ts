import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import {
  finDeDiaCDMX,
  getEstadoTraslados,
  inicioDeDiaCDMX,
  invalidateTrasladosConfig,
} from "@/lib/traslados-config";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * Normaliza una fecha del formulario (`"2026-10-15"` o vacío) al instante que
 * corresponde en CDMX. `esFin` marca los extremos de cierre, que se guardan a las
 * 23:59:59.999 para que el último día cuente completo.
 */
function parseFecha(valor: unknown, esFin: boolean): Date | null | "invalida" {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor !== "string") return "invalida";
  const fecha = esFin ? finDeDiaCDMX(valor) : inicioDeDiaCDMX(valor);
  return fecha ?? "invalida";
}

export const PUT: APIRoute = async ({ request, locals }) => {
  const session = locals.session;

  if (!session?.user?.id) {
    return json({ message: "No autorizado" }, 401);
  }

  if (!session.user.secciones?.includes("admin_siget_traslados")) {
    return json({ message: "Permisos insuficientes" }, 403);
  }

  try {
    const body = await request.json();

    const fechaInicio = parseFecha(body.fechaInicio, false);
    const fechaFin = parseFecha(body.fechaFin, true);
    const fechaFinVirtual = parseFecha(body.fechaFinVirtual, true);

    if (fechaInicio === "invalida" || fechaFin === "invalida" || fechaFinVirtual === "invalida") {
      return json({ message: "Formato de fecha inválido. Se espera AAAA-MM-DD." }, 400);
    }

    // El periodo es indivisible: o se configuran las dos fechas, o ninguna (que
    // es como se cierran los traslados).
    if (Boolean(fechaInicio) !== Boolean(fechaFin)) {
      return json(
        { message: "Indica la fecha de inicio y la de fin del periodo, o deja las dos vacías." },
        400
      );
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      return json({ message: "La fecha de inicio no puede ser posterior a la de fin." }, 400);
    }

    if (fechaFinVirtual) {
      if (!fechaInicio || !fechaFin) {
        return json(
          { message: "Para limitar Campus Virtual primero define el periodo de traslados." },
          400
        );
      }
      if (fechaFinVirtual < fechaInicio || fechaFinVirtual > fechaFin) {
        return json(
          { message: "La fecha límite de Campus Virtual debe caer dentro del periodo de traslados." },
          400
        );
      }
    }

    // `null` = automático: el ciclo siguiente al activo.
    let cicloId: number | null = null;
    if (body.cicloId !== null && body.cicloId !== undefined && body.cicloId !== "") {
      cicloId = Number(body.cicloId);
      if (!Number.isInteger(cicloId) || cicloId <= 0) {
        return json({ message: "Ciclo inválido" }, 400);
      }
      const existe = await prisma.ciclo.findUnique({ where: { id: cicloId }, select: { id: true } });
      if (!existe) {
        return json({ message: "El ciclo indicado no existe" }, 400);
      }
    }

    const data = {
      fecha_inicio_traslados: fechaInicio,
      fecha_fin_traslados: fechaFin,
      fecha_fin_trl_virtual: fechaFinVirtual,
      cicloId,
      actualizado_porId: Number(session.user.id),
    };

    // La tabla es de una sola fila y la crea la migración. El `create` es sólo
    // una red de seguridad para una BD sembrada sin ella.
    const actual = await prisma.configuracionTraslados.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (actual) {
      await prisma.configuracionTraslados.update({ where: { id: actual.id }, data });
    } else {
      await prisma.configuracionTraslados.create({ data });
    }

    await prisma.logs.create({
      data: {
        accion: "Configurar Periodo Traslados",
        detalles:
          `El administrador (ID: ${session.user.id}) configuró el periodo de traslados: ` +
          `inicio=${body.fechaInicio || "—"}, fin=${body.fechaFin || "—"}, ` +
          `fin Virtual=${body.fechaFinVirtual || "—"}, ciclo=${cicloId ?? "automático"}.`,
        usuarioId: Number(session.user.id),
      },
    });

    // Basta con descartar este caché: el callback `jwt` recalcula las secciones en
    // cada petición y lee el periodo desde aquí, así que no hace falta invalidar
    // las sesiones (los permisos de rol y de usuario no cambian).
    invalidateTrasladosConfig();

    const estado = await getEstadoTraslados();

    return json(
      {
        message: estado.periodoAbierto
          ? "Periodo guardado. La sección de traslados está visible."
          : "Periodo guardado. La sección de traslados permanece oculta.",
        estado,
      },
      200
    );
  } catch (error) {
    console.error("Error al configurar el periodo de traslados:", error);
    return json({ message: "Error interno del servidor" }, 500);
  }
};
