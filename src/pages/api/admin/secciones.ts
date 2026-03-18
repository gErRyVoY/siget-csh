import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { getSession } from "auth-astro/server";

export const PATCH: APIRoute = async ({ request }) => {
  const session = await getSession(request);

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ message: "No autorizado" }), { status: 401 });
  }

  // Verificar que el usuario tenga permiso de Administrador -> Secciones
  if (!session.user.secciones?.includes('admin_siget_secciones')) {
    return new Response(JSON.stringify({ message: "Permisos insuficientes" }), { status: 403 });
  }

  try {
    const { seccionId, activo } = await request.json();

    if (!seccionId || typeof activo !== 'boolean') {
      return new Response(JSON.stringify({ message: "Datos incompletos o inválidos" }), { status: 400 });
    }

    const updatedSeccion = await prisma.seccion.update({
      where: { id: parseInt(seccionId, 10) },
      data: { activo },
    });

    // Registrar en los logs
    await prisma.logs.create({
      data: {
        accion: activo ? 'Habilitar Sección Global' : 'Inhabilitar Sección Global',
        detalles: `El administrador (ID: ${session.user.id}) ${activo ? 'habilitó' : 'inhabilitó'} la sección global: ${updatedSeccion.nombre} (ID: ${seccionId}).`,
        usuarioId: Number(session.user.id),
      }
    });

    return new Response(JSON.stringify({ message: "Sección actualizada", seccion: updatedSeccion }), { status: 200 });

  } catch (error) {
    console.error("Error al actualizar sección global:", error);
    return new Response(JSON.stringify({ message: "Error interno del servidor" }), { status: 500 });
  }
};
