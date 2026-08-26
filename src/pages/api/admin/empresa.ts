import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';

// GET: Obtener información de una empresa mediante slug
export const GET: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
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
export const PATCH: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  try {
    const data = await request.json();
    const { slug, tckt_virtual, tckt_csh, tckt_mkt } = data;
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
    if (typeof tckt_csh === 'boolean') {
      updateData.tckt_csh = tckt_csh;
    }
    if (typeof tckt_mkt === 'boolean') {
      updateData.tckt_mkt = tckt_mkt;
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

// POST: Crear una nueva empresa
export const POST: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  try {
    const data = await request.json();
    const { nombre, slug, tipo, activa, tckt_csh, tckt_mkt, tckt_virtual } = data;
    const adminUserId = parseInt(session.user.id as string, 10);

    if (isNaN(adminUserId)) {
      return new Response(JSON.stringify({ message: 'ID de administrador inválido en la sesión.' }), { status: 400 });
    }

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return new Response(JSON.stringify({ message: 'El nombre de la empresa es requerido.' }), { status: 400 });
    }

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return new Response(JSON.stringify({ message: 'El slug es requerido.' }), { status: 400 });
    }

    const validTipos = ['Magno', 'Ejecutivo', 'Social', 'Oficina'];
    if (!tipo || !validTipos.includes(tipo)) {
      return new Response(JSON.stringify({ message: 'Tipo de empresa inválido. Debe ser Magno, Ejecutivo, Social u Oficina.' }), { status: 400 });
    }

    // Normalizar slug de forma estricta
    const cleanSlug = slug
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!cleanSlug) {
      return new Response(JSON.stringify({ message: 'El slug es inválido tras la sanitización.' }), { status: 400 });
    }

    // Verificar si el slug ya existe
    const existing = await prisma.empresa.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      return new Response(JSON.stringify({ message: `El slug '${cleanSlug}' ya se encuentra registrado por otra empresa ("${existing.nombre}").` }), { status: 400 });
    }

    // Sincronizar secuencia de Postgres por si hubo seeding manual previo
    await prisma.$executeRawUnsafe(`
      SELECT setval(pg_get_serial_sequence('empresa', 'id'), coalesce(max(id),0) + 1, false) FROM empresa;
    `);

    const newEmpresa = await prisma.empresa.create({
      data: {
        nombre: nombre.trim(),
        slug: cleanSlug,
        tipo,
        activa: typeof activa === 'boolean' ? activa : true,
        tckt_csh: typeof tckt_csh === 'boolean' ? tckt_csh : true,
        tckt_mkt: typeof tckt_mkt === 'boolean' ? tckt_mkt : false,
        tckt_virtual: typeof tckt_virtual === 'boolean' ? tckt_virtual : false,
      },
    });

    await prisma.logs.create({
      data: {
        accion: `Creación de empresa (ID: ${newEmpresa.id}, ${newEmpresa.nombre})`,
        detalles: { adminUserId, empresa: newEmpresa },
        usuarioId: adminUserId,
      },
    });

    return new Response(JSON.stringify(newEmpresa), { status: 201 });
  } catch (error: any) {
    console.error('Error al crear la empresa:', error);
    return new Response(JSON.stringify({ message: error.message || 'Error interno del servidor' }), { status: 500 });
  }
};
