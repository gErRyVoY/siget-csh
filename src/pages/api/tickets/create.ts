import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/db';
import { sendNotification } from '../notifications/sse';
import { findBestAgentHybrid } from '../../../services/ticketAssignmentService';
import { ensureActiveCycle } from '../../../services/cycleService';
import { sendTicketNotification } from '../../../services/emailService';

export const POST: APIRoute = async ({ request, locals }) => {
  const session = locals.session;

  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 });
  }

  try {
    await ensureActiveCycle();
    
    const data = await request.json();
    const { categoriaId, subcategoriaId, descripcion, afectado_clave, afectado_nombre, afectado_campus, afectado_campus_slug, multiple_clave } = data;
    // Check "Múltiple ..." del formulario: el ticket cubre a varios afectados, así que
    // no hay un identificador ni un nombre únicos que exigir. Los datos de cada uno
    // viajan en los adjuntos o en la descripción.
    const isMultipleClave = multiple_clave === true;
    const parsedCategoriaId = parseInt(categoriaId, 10);
    const parsedSubcategoriaId = subcategoriaId ? parseInt(subcategoriaId, 10) : null;

    if (isNaN(parsedCategoriaId) || !descripcion) {
      return new Response(
        JSON.stringify({ message: 'Faltan campos requeridos o son inválidos.' }),
        { status: 400 }
      );
    }

    const solicitanteId = parseInt(session.user.id as string, 10);

    if (isNaN(solicitanteId)) {
      return new Response(JSON.stringify({ message: 'ID de usuario inválido en la sesión.' }), { status: 400 });
    }

    let targetEmpresaId = session.user.empresa?.id || 1;

    // Validación para categorías especiales (1: Alumno, 2: Aspirante, 3: Colaborador, 4: Docente)
    if ([1, 2, 3, 4].includes(parsedCategoriaId)) {
      // 1. Campus: requerido y solo letras/números/espacios
      if (!afectado_campus || typeof afectado_campus !== 'string' || !afectado_campus.trim()) {
        return new Response(
          JSON.stringify({ message: 'El campo Campus es requerido.' }),
          { status: 400 }
        );
      }

      const campusTrimmed = afectado_campus.trim();

      // El campus se resuelve contra la BD, no con un filtro de caracteres: el
      // formulario manda el slug de la empresa (único, estable y sin acentos) y se
      // cae al nombre solo por compatibilidad con clientes que aún no lo envíen.
      // Un campus que no corresponde a una empresa activa se rechaza, en lugar de
      // caer en silencio a la empresa de la sesión.
      const campusSlug = typeof afectado_campus_slug === 'string' ? afectado_campus_slug.trim() : '';
      const matchedEmpresa = campusSlug
        ? await prisma.empresa.findFirst({
            where: { slug: campusSlug, activa: true },
            select: { id: true },
          })
        : await prisma.empresa.findFirst({
            where: {
              nombre: { equals: campusTrimmed, mode: 'insensitive' },
              activa: true,
            },
            select: { id: true },
          });

      if (!matchedEmpresa) {
        return new Response(
          JSON.stringify({ message: 'El Campus seleccionado no corresponde a un campus activo.' }),
          { status: 400 }
        );
      }
      targetEmpresaId = matchedEmpresa.id;

      // Con "Múltiple ..." el Nombre completo y el identificador quedan fuera de juego:
      // se omite su validación y el ticket se guarda sin esos datos.
      if (!isMultipleClave) {
        // 2. Nombre completo: requerido
        if (!afectado_nombre || typeof afectado_nombre !== 'string' || !afectado_nombre.trim()) {
          return new Response(
            JSON.stringify({ message: 'El campo Nombre completo es requerido.' }),
            { status: 400 }
          );
        }

        // 3. Identificador según categoría
        if (!afectado_clave || typeof afectado_clave !== 'string' || !afectado_clave.trim()) {
          const fieldName = parsedCategoriaId === 1 ? 'Matrícula' : parsedCategoriaId === 2 ? 'Folio' : parsedCategoriaId === 3 ? 'Email' : 'Clave';
          return new Response(
            JSON.stringify({ message: `El campo ${fieldName} es requerido.` }),
            { status: 400 }
          );
        }

        const claveTrimmed = afectado_clave.trim();

        if (parsedCategoriaId === 1) {
          // Alumno: Matrícula solo letras y números (sin diacríticos)
          if (!/^[a-zA-Z0-9]+$/.test(claveTrimmed)) {
            return new Response(
              JSON.stringify({ message: 'La Matrícula solo debe contener letras y números sin signos diacríticos.' }),
              { status: 400 }
            );
          }
        } else if (parsedCategoriaId === 3) {
          // Colaborador: Email institucional
          const emailParts = claveTrimmed.split('@');
          const localPart = emailParts[0];
          if (!/^[a-zA-Z0-9.-]+$/.test(localPart)) {
            return new Response(
              JSON.stringify({ message: 'El correo del colaborador contiene caracteres no permitidos. Solo se permiten letras, números, punto y guión medio.' }),
              { status: 400 }
            );
          }
        }
      }
    }

    // --- NUEVA LÓGICA DE ASIGNACIÓN HÍBRIDA ---
    const assignmentResult = await findBestAgentHybrid({
      solicitanteId,
      categoriaId: parsedCategoriaId,
      subcategoriaId: parsedSubcategoriaId,
    });

    const atiendeId = assignmentResult.agentId;
    const empresaId = targetEmpresaId;

    // Determinar prioridad basada en el rol del usuario
    let prioridad: 'Baja' | 'Media' | 'Alta' = 'Baja';
    const nivelSoporte = session.user.rol?.nivel_soporte;

    if (nivelSoporte) {
      switch (nivelSoporte) {
        case 'Usuario':
          prioridad = 'Baja';
          break;
        case 'S_1':
        case 'S_2':
        case 'Desarrollador':
        case 'Coordinador':
        case 'Contador':
        case 'Marketing':
          prioridad = 'Media';
          break;
        case 'S_3':
        case 'Director':
          prioridad = 'Alta';
          break;
        default:
          prioridad = 'Baja'; // Fallback
      }
    }

    let nuevoTicket;

    // Con "Múltiple ..." no se persiste identificador ni nombre, aunque el cliente los mande
    const afectadoClaveFinal = !isMultipleClave && afectado_clave ? String(afectado_clave).trim() : null;
    const afectadoNombreFinal = !isMultipleClave && afectado_nombre ? String(afectado_nombre).trim() : null;

    if (atiendeId) {
      // Agente encontrado
      [nuevoTicket] = await prisma.$transaction([
        prisma.ticket.create({
          data: {
            solicitanteId,
            atiendeId,
            estatusId: 2, // Nuevo y asignado
            empresaId,
            prioridad,
            archivado: false,
            categoriaId: parsedCategoriaId,
            subcategoriaId: parsedSubcategoriaId,
            descripcion: descripcion,
            afectado_clave: afectadoClaveFinal,
            afectado_nombre: afectadoNombreFinal,
          },
        }),
        prisma.usuario.update({
          where: { id: atiendeId },
          data: { carga_actual: { increment: 1 } },
        }),
      ]);

      console.log(`[Ticket ${nuevoTicket.id}] Asignado a agente ${atiendeId} (tipo: ${assignmentResult.assignmentType})`);
    } else {
      // Sin agente disponible
      nuevoTicket = await prisma.ticket.create({
        data: {
          solicitanteId,
          atiendeId: null,
          estatusId: 1, // Sin asignar
          empresaId,
          prioridad,
          archivado: false,
          categoriaId: parsedCategoriaId,
          subcategoriaId: parsedSubcategoriaId,
          descripcion: descripcion,
          afectado_clave: afectadoClaveFinal,
          afectado_nombre: afectadoNombreFinal,
        },
      });

      console.warn(`[Ticket ${nuevoTicket.id}] Creado sin asignar (razón: ${assignmentResult.reason})`);
    }

    // Notificar via SSE
    const notificationPayload = {
      type: 'ticket_created' as const,
      message: `Se ha creado un nuevo ticket #${nuevoTicket.id}`,
      ticketId: nuevoTicket.id,
      originatorId: String(session.user.id)
    };

    const targetUsers: number[] = [];
    if (atiendeId) {
      targetUsers.push(atiendeId);
    }

    sendNotification(notificationPayload, targetUsers.length > 0 ? targetUsers : undefined);

    // Enviar correos de notificación de forma asíncrona
    (async () => {
      try {
        const originUrl = new URL(request.url).origin;

        const [solicitante, categoria] = await Promise.all([
          prisma.usuario.findUnique({
            where: { id: solicitanteId },
            select: { nombres: true, apellidos: true, mail: true }
          }),
          prisma.categoria.findUnique({
            where: { id: parsedCategoriaId },
            select: { nombre: true }
          })
        ]);

        const solicitanteNombre = solicitante
          ? `${solicitante.nombres} ${solicitante.apellidos}`
          : 'Usuario';
        const categoriaNombre = categoria?.nombre || 'General';

        if (atiendeId) {
          // --- Caso A: Ticket con agente asignado ---
          const agente = await prisma.usuario.findUnique({
            where: { id: atiendeId },
            select: { nombres: true, apellidos: true, mail: true }
          });

          const agenteNombre = agente ? `${agente.nombres} ${agente.apellidos}` : 'Agente';

          const ticketInfo = {
            categoria: categoriaNombre,
            descripcion: descripcion,
            prioridad: prioridad,
            solicitanteNombre,
            agenteNombre,
          };

          // Correo al agente: "Tienes un nuevo ticket de {solicitanteNombre}"
          if (agente?.mail) {
            await sendTicketNotification({
              ticketId: nuevoTicket.id,
              event: 'ticket_creado',
              destinatarioId: atiendeId,
              destinatarioMail: agente.mail,
              originUrl,
              fromName: solicitanteNombre,
              ticketInfo,
            });
          }

          // Correo al solicitante: "Tu ticket fue asignado a {agenteNombre}"
          if (solicitante?.mail) {
            await sendTicketNotification({
              ticketId: nuevoTicket.id,
              event: 'ticket_creado_solicitante',
              destinatarioId: solicitanteId,
              destinatarioMail: solicitante.mail,
              originUrl,
              fromName: agenteNombre,
              ticketInfo,
            });
          }
        } else {
          // --- Caso B: Ticket sin asignar (ningún agente disponible en este momento) ---
          // Correo al solicitante: "Tu ticket está en espera de asignación"
          if (solicitante?.mail) {
            await sendTicketNotification({
              ticketId: nuevoTicket.id,
              event: 'ticket_sin_asignar',
              destinatarioId: solicitanteId,
              destinatarioMail: solicitante.mail,
              originUrl,
              ticketInfo: {
                categoria: categoriaNombre,
                descripcion: descripcion,
                prioridad: prioridad,
                solicitanteNombre,
              },
            });
          }
        }
      } catch (emailErr) {
        console.error('[EmailNotificationError] Error al procesar notificación de ticket creado:', emailErr);
      }
    })();

    return new Response(JSON.stringify(nuevoTicket), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error al crear el ticket:', error);
    return new Response(
      JSON.stringify({ message: 'Error interno del servidor al crear el ticket.' }),
      { status: 500 }
    );
  }
};
