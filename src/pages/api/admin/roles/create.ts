import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { getSession } from "auth-astro/server";

export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: "No autorizado" }), {
      status: 401,
    });
  }

  try {
    const data = await request.json();
    const { nuevoRolNombre, clonarRolId } = data;
    const adminUserId = parseInt(session.user.id as string, 10);

    if (!nuevoRolNombre || typeof nuevoRolNombre !== 'string' || nuevoRolNombre.trim() === '') {
      return new Response(JSON.stringify({ message: "Nombre de rol inválido." }), { status: 400 });
    }

    if (!clonarRolId || isNaN(parseInt(clonarRolId, 10))) {
        return new Response(JSON.stringify({ message: "Debes seleccionar un rol para clonar permisos." }), { status: 400 });
    }

    const sourceRoleId = parseInt(clonarRolId, 10);
    const sourceRole = await prisma.rol.findUnique({
        where: { id: sourceRoleId },
        include: {
            permisos_seccion: true,
            permisos_categoria: true,
        }
    });

    if (!sourceRole) {
        return new Response(JSON.stringify({ message: "El rol seleccionado para clonar no existe." }), { status: 404 });
    }

    // Wrap the clone operation in a transaction
    const newRole = await prisma.$transaction(async (tx) => {
        // Get max ID to avoid sequence mismatch after manual DB seed
        const maxLevel = await tx.rol.aggregate({
            _max: { id: true }
        });
        const nextId = (maxLevel._max.id || 0) + 1;

        // Create new role
        const createdRole = await tx.rol.create({
            data: {
                id: nextId,
                rol: nuevoRolNombre.trim(),
                descripcion: `Clonado de ${sourceRole.rol}`,
                nivel_soporte: sourceRole.nivel_soporte // Must copy from source because it's a required enum
            }
        });

        // Clone Permisos Seccion
        if (sourceRole.permisos_seccion.length > 0) {
            await tx.permisoRolSeccion.createMany({
                data: sourceRole.permisos_seccion.map(ps => ({
                    rolId: createdRole.id,
                    seccionId: ps.seccionId,
                    activo: ps.activo
                }))
            });
        }

        // Clone Permisos Categoria
        if (sourceRole.permisos_categoria.length > 0) {
            await tx.permisoCategoria.createMany({
                data: sourceRole.permisos_categoria.map(pc => ({
                    rolId: createdRole.id,
                    categoriaId: pc.categoriaId,
                    subcategoriaId: pc.subcategoriaId,
                    activo: pc.activo
                }))
            });
        }

        await tx.logs.create({
            data: {
              accion: `Creación de rol (ID: ${createdRole.id}) clonando de (ID: ${sourceRole.id})`,
              detalles: { adminUserId, ...createdRole },
              usuarioId: adminUserId,
            },
        });

        return createdRole;
    });

    return new Response(JSON.stringify(newRole), { status: 201 });
  } catch (error: any) {
    console.error("Error creating role:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor", details: error.message }),
      { status: 500 },
    );
  }
};
