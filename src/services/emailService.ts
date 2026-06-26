import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { prisma } from "@/lib/db";
import { EstatusCorreo } from "@prisma/client";

// Ensure environment variables are set or fallback to disable sending
const isSesConfigured = !!(
  process.env.S3_ACCESS_KEY_ID &&
  process.env.S3_SECRET_ACCESS_KEY &&
  (process.env.SES_FROM_EMAIL || process.env.S3_BUCKET_NAME)
);

const sesClient = isSesConfigured
  ? new SESClient({
    region: process.env.SES_REGION || process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  })
  : null;

const FROM_EMAIL = process.env.SES_FROM_EMAIL || "siget@humanitas.edu.mx";
const FROM_NAME = process.env.SES_FROM_NAME || "Centro de Soporte Humanitas";

export interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
}

/**
 * Sends a raw HTML email using AWS SES.
 */
export async function sendEmail({ to, subject, htmlBody }: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isSesConfigured || !sesClient) {
    const errorMsg = "AWS SES no está configurado. Verifica las variables de entorno en el archivo .env.";
    console.warn(`[EmailService] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: htmlBody,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
      },
      Source: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    });

    const response = await sesClient.send(command);
    console.log(`[EmailService] Correo enviado exitosamente a ${to}. MessageId: ${response.MessageId}`);
    return { success: true, messageId: response.MessageId };
  } catch (error: any) {
    console.error(`[EmailService] Error al enviar correo a ${to}:`, error);
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Wraps content in a standardized Universidad Humanitas HTML template.
 */
function getHtmlWrapper(title: string, contentHtml: string): string {
  const currentYear = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap');
    body {
      font-family: 'Montserrat', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f3f4f6;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f3f4f6;
      padding: 20px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      /*border-radius: 8px;*/
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      background-color: #caab55; /* Dorado Institucional */
      color: #ffffff;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      font-family: 'Cinzel', Georgia, serif;
      margin: 0;
      font-size: 24px;
      font-weight: 400;
    }
    .content {
      padding: 30px 20px;
      color: #374151;
      line-height: 1.6;
      font-size: 16px;
    }
    .btn {
      display: inline-block;
      background-color: #881912; /* Guinda */
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      /*border-radius: 6px;*/
      font-weight: bold;
      margin-top: 20px;
      text-align: center;
    }
    .footer {
      background-color: #caab55;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #ffffff;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="https://raw.githubusercontent.com/gErRyVoY/siget-csh/siget-apprunner-new/public/logo-h-white.png" alt="Logo Universidad Humanitas" style="max-width: 150px;">
        <h1>Centro de Soporte Humanitas</h1>
      </div>
      <div class="content">
        ${contentHtml}
      </div>
      <div class="footer">
        Este es un correo automático generado por el Sistema de Gestión de Tickets (SiGeT).<br>
        Por favor, no respondas a este mensaje.<br>
        &copy; ${currentYear} Universidad Humanitas. Todos los derechos reservados.
      </div>
    </div>
  </div>
</body>
</html>`;
}

interface TicketNotificationParams {
  ticketId: number;
  event: "ticket_creado" | "ticket_actualizado" | "ticket_asignado" | "traslado_creado";
  destinatarioId: number;
  destinatarioMail: string;
  originUrl?: string; // e.g. "http://localhost:4321" or production domain
  ticketInfo: {
    categoria: string;
    descripcion: string;
    prioridad: string;
    solicitanteNombre: string;
    agenteNombre?: string;
    estatus?: string;
    comentario?: string;
    // Specific for transfers
    folio?: string;
    matricula?: string;
    alumno?: string;
    carrera?: string;
    origen?: string;
    destino?: string;
  };
}

/**
 * Resolves or seeds the default templates in the database if they don't exist.
 */
async function getOrCreatePlantilla(nombre: string, event: string) {
  const existing = await prisma.plantillaCorreo.findFirst({
    where: { nombre, activo: true }
  });

  if (existing) return existing;

  // Fallback contents for templates
  let contenido = "";
  let subject = "";

  if (event === "ticket_creado") {
    subject = "Nuevo ticket asignado #{{ticketId}}";
    contenido = `<h2>Hola {{agenteNombre}},</h2>
<p>Se ha creado y asignado a ti un nuevo ticket en el sistema.</p>
<div style="background-color: #f9fafb; border-left: 4px solid #caab55; padding: 15px; margin: 15px 0;">
  <strong>Folio del ticket:</strong> #{{ticketId}}<br>
  <strong>Categoría:</strong> {{categoria}}<br>
  <strong>Solicitante:</strong> {{solicitanteNombre}}<br>
  <strong>Prioridad:</strong> {{prioridad}}<br>
  <strong>Descripción:</strong> {{descripcion}}
</div>
<p>Por favor, haz clic en el siguiente botón para ver los detalles del ticket y comenzar a trabajar en él:</p>
<a href="{{ticketUrl}}" class="btn">Ver ticket</a>`;
  } else if (event === "ticket_actualizado") {
    subject = "Actualización de estatus: ticket #{{ticketId}}";
    contenido = `<h2>Hola {{solicitanteNombre}},</h2>
<p>El ticket #{{ticketId}} ha cambiado de estado.</p>
<div style="background-color: #f9fafb; border-left: 4px solid #caab55; padding: 15px; margin: 15px 0;">
  <strong>Folio del ticket:</strong> #{{ticketId}}<br>
  <strong>Categoría:</strong> {{categoria}}<br>
  <strong>Nuevo estatus:</strong> <span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 6px; font-weight: bold;">{{estatus}}</span><br>
  <strong>Descripción:</strong> {{descripcion}}
</div>
{{comentarioSection}}
<p>Haz clic en el siguiente botón para ver el historial completo y detalles del ticket:</p>
<a href="{{ticketUrl}}" class="btn">Ir al ticket</a>`;
  } else if (event === "ticket_asignado") {
    subject = "Ticket reasignado #{{ticketId}}";
    contenido = `<h2>Hola {{agenteNombre}},</h2>
<p>Se te ha reasignado el ticket #{{ticketId}} en el sistema.</p>
<div style="background-color: #f9fafb; border-left: 4px solid #caab55; padding: 15px; margin: 15px 0;">
  <strong>Folio del ticket:</strong> #{{ticketId}}<br>
  <strong>Categoría:</strong> {{categoria}}<br>
  <strong>Solicitante:</strong> {{solicitanteNombre}}<br>
  <strong>Prioridad:</strong> {{prioridad}}<br>
  <strong>Descripción:</strong> {{descripcion}}
</div>
<p>Por favor, haz clic en el siguiente botón para ver los detalles del ticket:</p>
<a href="{{ticketUrl}}" class="btn">Ver ticket</a>`;
  } else if (event === "traslado_creado") {
    subject = "Nuevo traslado #TRL-{{ticketId}}";
    contenido = `<h2>Hola {{agenteNombre}},</h2>
<p>Se ha iniciado un nuevo trámite de traslado en el sistema.</p>
<div style="background-color: #f9fafb; border-left: 4px solid #caab55; padding: 15px; margin: 15px 0;">
  <strong>Folio:</strong> #TRL-{{ticketId}}<br>
  <strong>Matrícula:</strong> {{matricula}}<br>
  <strong>Alumno:</strong> {{alumno}}<br>
  <strong>Carrera:</strong> {{carrera}}<br>
  <strong>Origen:</strong> {{origen}}<br>
  <strong>Destino:</strong> {{destino}}<br>
  <strong>Prioridad:</strong> {{prioridad}}<br>
  <strong>Descripción:</strong> {{descripcion}}
</div>
<p>Haz clic en el siguiente botón para auditar y gestionar este traslado:</p>
<a href="{{ticketUrl}}" class="btn">Ver traslado</a>`;
  }

  return await prisma.plantillaCorreo.create({
    data: {
      nombre,
      contenido,
      tipo: "Notificacion_sistema",
      activo: true
    }
  });
}

/**
 * High-level function to send a ticket notification and log it to the database.
 * Designed to run in the background (asynchronous, tolerates failures).
 */
export async function sendTicketNotification({
  ticketId,
  event,
  destinatarioId,
  destinatarioMail,
  originUrl = "https://siget.humanitas.edu.mx",
  ticketInfo,
}: TicketNotificationParams): Promise<void> {
  // Execute in try-catch to avoid breaking the calling API route
  try {
    const defaultHost = originUrl.replace(/\/$/, ""); // Remove trailing slash
    const ticketUrl = `${defaultHost}/tickets/view/${ticketId}`;

    // Get the template from the database
    const plantilla = await getOrCreatePlantilla(event, event);

    // Subject parsing
    let subject = event === "traslado_creado"
      ? `[Traslados] Nuevo traslado asignado #TRL-${ticketId}`
      : event === "ticket_creado"
        ? `[SiGeT] Nuevo ticket asignado #${ticketId}`
        : event === "ticket_asignado"
          ? `[SiGeT] Ticket reasignado #${ticketId}`
          : `[SiGeT] Actualización del ticket #${ticketId}`;

    // Populate template fields
    let templateHtml = plantilla.contenido || "";

    // Simple template engines replacement
    const replacements: Record<string, string> = {
      "{{ticketId}}": String(ticketId),
      "{{categoria}}": ticketInfo.categoria || "",
      "{{descripcion}}": ticketInfo.descripcion || "",
      "{{prioridad}}": ticketInfo.prioridad || "",
      "{{solicitanteNombre}}": ticketInfo.solicitanteNombre || "",
      "{{agenteNombre}}": ticketInfo.agenteNombre || "Agente",
      "{{usuarioNombre}}": ticketInfo.solicitanteNombre || "",
      "{{estatus}}": ticketInfo.estatus || "",
      "{{folio}}": ticketInfo.folio || "",
      "{{matricula}}": ticketInfo.matricula || "",
      "{{alumno}}": ticketInfo.alumno || "",
      "{{carrera}}": ticketInfo.carrera || "",
      "{{origen}}": ticketInfo.origen || "",
      "{{destino}}": ticketInfo.destino || "",
      "{{ticketUrl}}": ticketUrl,
    };

    // Comentario section conditional replacement
    if (ticketInfo.comentario) {
      const commentHtml = `<div style="background-color: #fffbeb; border-left: 4px solid #caab55; padding: 15px; margin: 15px 0;">
        <strong>Comentario de actualización:</strong><br>
        <em>${ticketInfo.comentario}</em>
      </div>`;
      templateHtml = templateHtml.replace("{{comentarioSection}}", commentHtml);
    } else {
      templateHtml = templateHtml.replace("{{comentarioSection}}", "");
    }

    for (const key in replacements) {
      templateHtml = templateHtml.replaceAll(key, replacements[key]);
    }

    const htmlBody = getHtmlWrapper(subject, templateHtml);

    // Send the email
    const sendResult = await sendEmail({
      to: destinatarioMail,
      subject,
      htmlBody,
    });

    // Write log to DB
    await prisma.notificacionesCorreo.create({
      data: {
        ticketId,
        destinatarioId,
        plantillaId: plantilla.id,
        estatus: sendResult.success ? EstatusCorreo.Enviado : EstatusCorreo.Fallido,
        mensaje_error: sendResult.success ? null : sendResult.error || "Fallo en el envío",
      },
    });

  } catch (error: any) {
    console.error(`[EmailService] Fallo crítico al enviar notificación de ticket:`, error);
  }
}
