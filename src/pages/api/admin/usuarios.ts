import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';
import type { Prisma, Usuario } from '@prisma/client';
import { getSession } from 'auth-astro/server';

// GET handler: Handles fetching lists of users with robust filtering.
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const params = url.searchParams;
  const userId = params.get('id');

  // --- Fetch a Single User ---
  if (userId) {
    try {
      const user = await prisma.usuario.findUnique({
        where: { id: parseInt(userId, 10) },
        include: { rol: true, empresa: true },
      });
      if (!user) {
        return new Response(JSON.stringify({ message: 'Usuario no encontrado' }), { status: 404 });
      }
      return new Response(JSON.stringify(user), { status: 200 });
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
    }
  }

  // --- Fetch a List of Users ---
  const campusSlug = params.get('campus');
  if (!campusSlug) {
    return new Response(JSON.stringify({ message: 'El parámetro campus es requerido para listar usuarios' }), { status: 400 });
  }

  try {
    const empresa = await prisma.empresa.findUnique({ where: { slug: campusSlug } });
    if (!empresa) {
      return new Response(JSON.stringify({ message: 'Empresa no encontrada' }), { status: 404 });
    }

    // Build a robust 'where' clause, starting with the mandatory company filter.
    const where: Prisma.UsuarioWhereInput = {
      empresaId: empresa.id,
    };

    const status = params.get('status');
    if (status === 'active') where.activo = true;
    else if (status === 'inactive') where.activo = false;

    const vacation = params.get('vacation');
    if (vacation === 'on') where.vacaciones = true;
    else if (vacation === 'off') where.vacaciones = false;

    const page = parseInt(params.get('page') || '1', 10);
    const limitParam = params.get('limit');
    const limit = limitParam === 'all' ? undefined : parseInt(limitParam || '10', 10);

    const totalUsers = await prisma.usuario.count({ where });
    const users = await prisma.usuario.findMany({
      where,
      skip: limit ? (page - 1) * limit : undefined,
      take: limit,
      orderBy: { nombres: 'asc' },
      include: { rol: true },
    });

    const totalPages = limit ? Math.ceil(totalUsers / limit) : 1;

    return new Response(JSON.stringify({
      users,
      pagination: { page, limit: limit || 'all', totalUsers, totalPages },
    }), { status: 200 });

  } catch (error) {
    console.error('Error fetching users:', error);
    return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
  }
};

// PATCH handler: Handles updating a single user securely and logging the changes.
export const PATCH: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  try {
    const data = await request.json();
    const { id, ...updateDataInput } = data;
    const adminUserId = parseInt(session.user.id as string, 10);

    if (isNaN(adminUserId)) {
      return new Response(JSON.stringify({ message: 'ID de administrador inválido en la sesión.' }), { status: 400 });
    }

    if (!id || typeof id !== 'number' || id <= 0) {
      return new Response(JSON.stringify({ message: 'El ID de usuario proporcionado no es válido' }), { status: 400 });
    }

    const userIdToUpdate = id;

    const userBeforeUpdate = await prisma.usuario.findUnique({ where: { id: userIdToUpdate } });
    if (!userBeforeUpdate) {
      return new Response(JSON.stringify({ message: 'Usuario a actualizar no encontrado' }), { status: 404 });
    }

    // Create a strongly-typed and validated object for the update payload
    const updateData: Prisma.UsuarioUpdateInput = {};

    if (updateDataInput.empresaId !== undefined) {
      updateData.empresa = { connect: { id: parseInt(updateDataInput.empresaId, 10) } };
    }
    if (updateDataInput.rolId !== undefined) {
      updateData.rol = { connect: { id: parseInt(updateDataInput.rolId, 10) } };
    }
    if (typeof updateDataInput.activo === 'boolean') {
      updateData.activo = updateDataInput.activo;
    }
    if (typeof updateDataInput.vacaciones === 'boolean') {
      updateData.vacaciones = updateDataInput.vacaciones;
    }
    if (updateDataInput.horario_disponibilidad !== undefined) {
      updateData.horario_disponibilidad = updateDataInput.horario_disponibilidad;
    }

    // Use a transaction to guarantee atomicity
    const updatedUser = await prisma.$transaction(async (tx) => {
      const userAfterUpdate = await tx.usuario.update({
        where: { id: userIdToUpdate }, // Strictly update only the user with this ID
        data: updateData,
      });

      const changes: { field: string, oldValue: any, newValue: any }[] = [];
      // Iterate over the keys of the validated updateData object for safe comparison
      for (const key of Object.keys(updateData)) {
        // Cast to `any` to bypass strict index checking, a common pattern for dynamic keys.
        const oldValue = (userBeforeUpdate as any)[key];
        const newValue = (userAfterUpdate as any)[key];

        // Use JSON.stringify for a robust comparison, especially for object-like values.
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
            accion: `Actualización de usuario (ID: ${userIdToUpdate})`,
            detalles: { adminUserId, changes },
            usuarioId: adminUserId,
          },
        });
      }

      return userAfterUpdate;
    });

    return new Response(JSON.stringify(updatedUser), { status: 200 });

  } catch (error) {
    console.error('Error updating user:', error);
    return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
  }
};

// DELETE handler: Handles deleting a user
export const DELETE: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get('id');
  const adminUserId = parseInt(session.user.id as string, 10);

  if (isNaN(adminUserId)) {
    return new Response(JSON.stringify({ message: 'ID de administrador inválido en la sesión.' }), { status: 400 });
  }

  if (!userId) {
    return new Response(JSON.stringify({ message: 'El ID del usuario es requerido' }), { status: 400 });
  }

  const userIdToDelete = parseInt(userId, 10);
  if (isNaN(userIdToDelete)) {
    return new Response(JSON.stringify({ message: 'El ID de usuario no es válido' }), { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const userToDelete = await tx.usuario.findUnique({ where: { id: userIdToDelete } });
      if (!userToDelete) {
        throw new Error('Usuario a eliminar no encontrado');
      }

      await tx.usuario.delete({ where: { id: userIdToDelete } });

      await tx.logs.create({
        data: {
          accion: `Eliminación de usuario (ID: ${userIdToDelete})`,
          detalles: { 
            adminUserId,
            deletedUser: userToDelete 
          },
          usuarioId: adminUserId,
        },
      });
    });

    return new Response(JSON.stringify({ message: 'Usuario eliminado correctamente' }), { status: 200 });

  } catch (error) {
    console.error('Error deleting user:', error);
    if (error instanceof Error && error.message.includes('no encontrado')) {
      return new Response(JSON.stringify({ message: error.message }), { status: 404 });
    }
    return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
  }
};