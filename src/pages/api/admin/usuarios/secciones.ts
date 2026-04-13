import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';
import { getSession } from 'auth-astro/server';

export const PATCH: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  try {
    const { usuarioId, seccionId, activo } = await request.json();
    const adminUserId = parseInt(session.user.id as string, 10);

    if (!usuarioId || !seccionId || typeof activo !== 'boolean') {
      return new Response(JSON.stringify({ message: 'Parámetros inválidos' }), { status: 400 });
    }

    // Upsert the PermisoUsuarioSeccion record
    const permiso = await prisma.permisoUsuarioSeccion.upsert({
      where: {
        usuarioId_seccionId: {
          usuarioId: parseInt(usuarioId),
          seccionId: parseInt(seccionId)
        }
      },
      update: { activo },
      create: {
        usuarioId: parseInt(usuarioId),
        seccionId: parseInt(seccionId),
        activo
      }
    });

    await prisma.logs.create({
      data: {
        accion: `Cambio de permiso de sección para usuario ID: ${usuarioId}`,
        detalles: { adminUserId, seccionId, activo },
        usuarioId: adminUserId,
      },
    });

    return new Response(JSON.stringify(permiso), { status: 200 });
  } catch (error) {
    console.error('Error updating section permission:', error);
    return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
  }
};
