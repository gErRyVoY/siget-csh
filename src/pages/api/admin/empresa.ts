import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';
import { getSession } from 'auth-astro/server';

// GET: Obtener información de una empresa mediante slug
export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return new Response(JSON.stringify({ message: 'El parámetro slug es requerido' }), { status: 400 });
  }

  try {
    const empresa = await prisma.empresa.findUnique({
      where: { slug },
    });

    if (!empresa) {
      return new Response(JSON.stringify({ message: 'Empresa no encontrada' }), { status: 404 });
    }

    return new Response(JSON.stringify(empresa), { status: 200 });
  } catch (error) {
    console.error('Error al obtener la empresa:', error);
    return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
  }
};

// PATCH: Actualizar información de una empresa mediante slug
export const PATCH: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  try {
    const data = await request.json();
    const { slug, tckt_virtual } = data;
    const adminUserId = parseInt(session.user.id as string, 10);

    if (isNaN(adminUserId)) {
      return new Response(JSON.stringify({ message: 'ID de administrador inválido en la sesión.' }), { status: 400 });
    }

    if (!slug) {
      return new Response(JSON.stringify({ message: 'El parámetro slug es requerido' }), { status: 400 });
    }

    const empresaBeforeUpdate = await prisma.empresa.findUnique({ where: { slug } });
    if (!empresaBeforeUpdate) {
      return new Response(JSON.stringify({ message: 'Empresa no encontrada' }), { status: 404 });
    }

    const updateData: any = {};
    if (typeof tckt_virtual === 'boolean') {
      updateData.tckt_virtual = tckt_virtual;
    }

    const updatedEmpresa = await prisma.$transaction(async (tx) => {
      const empresaAfterUpdate = await tx.empresa.update({
        where: { slug },
        data: updateData,
      });

      const changes: { field: string, oldValue: any, newValue: any }[] = [];
      for (const key of Object.keys(updateData)) {
        const oldValue = (empresaBeforeUpdate as any)[key];
        const newValue = (empresaAfterUpdate as any)[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes.push({
            field: key,
            oldValue,
            newValue,
          });
        }
      }

      if (changes.length > 0) {
        await tx.logs.create({
          data: {
            accion: `Actualización de empresa (ID: ${empresaBeforeUpdate.id}, ${empresaBeforeUpdate.nombre})`,
            detalles: { adminUserId, changes },
            usuarioId: adminUserId,
          },
        });
      }

      return empresaAfterUpdate;
    });

    return new Response(JSON.stringify(updatedEmpresa), { status: 200 });
  } catch (error) {
    console.error('Error al actualizar la empresa:', error);
    return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
  }
};
