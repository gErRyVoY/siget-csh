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
 * NOTE: All styles are intentionally inline to preserve design when emails
 * are forwarded, as email clients strip <style> blocks on forward.
 */
function getHtmlWrapper(title: string, contentHtml: string): string {
  const currentYear = new Date().getFullYear();

  // --- Inline style constants ---
  const bodyStyle = "font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0;";
  const wrapperStyle = "width: 100%; background-color: #f3f4f6; padding: 20px 0;";
  const containerStyle = "max-width: 600px; margin: 0 auto; background-color: #ffffff; overflow: hidden;";
  const headerStyle = "background-color: #caab55; color: #ffffff; padding: 30px 20px; text-align: center;";
  const logoStyle = "display: inline-block; vertical-align: middle; max-width: 50px; width: 50px;";
  const h1Style = "display: inline-block; vertical-align: middle; font-family: Georgia, 'Times New Roman', serif; margin: 0 0 0 14px; font-size: 22px; font-weight: 400; color: #ffffff; letter-spacing: 1px;";
  const contentStyle = "padding: 30px 20px; color: #374151; line-height: 1.6; font-size: 16px;";
  const footerStyle = "background-color: #caab55; padding: 20px; text-align: center; font-size: 12px; color: #ffffff; border-top: 3px solid #b8962e;";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="${bodyStyle}">
  <div style="${wrapperStyle}">
    <div style="${containerStyle}">
      <div style="${headerStyle}">
        <img src="https://raw.githubusercontent.com/gErRyVoY/siget-csh/siget-apprunner-new/public/logo-h-white-v2.png" alt="Logo Universidad Humanitas" style="${logoStyle}">
        <h1 style="${h1Style}">CENTRO DE SOPORTE HUMANITAS</h1>
      </div>
      <div style="${contentStyle}">
        ${contentHtml}
      </div>
      <div style="${footerStyle}">
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
 * Resolves or upserts the default templates in the database.
 * Always updates the content to ensure inline styles are applied,
 * fixing any existing records that may have CSS classes instead of inline styles.
 */
async function getOrCreatePlantilla(nombre: string, event: string) {
  const existing = await prisma.plantillaCorreo.findFirst({
    where: { nombre, activo: true }
  });

  // Fallback contents for templates
  let contenido = "";
  let subject = "";

  // NOTE: Buttons use fully inline styles (no class="btn") so they render
  // correctly even when the email is forwarded by the recipient.
  const btnStyle = "display: inline-block; background-color: #881912; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: bold; margin-top: 20px; text-align: center; font-size: 15px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;";

  if (event === "ticket_creado") {
    subject = "Nuevo ticket asignado #{{ticketId}}";
    contenido = `<h2 style="color: #1f2937; margin: 0 0 12px;">Hola {{agenteNombre}},</h2>
<p style="margin: 0 0 16px;">Se ha creado y asignado a ti un <strong>nuevo ticket</strong> en el sistema.</p>
<div style="background-color: #f9fafb; border-left: 4px solid #caab55; padding: 15px; margin: 15px 0;">
  <strong>ID del Ticket:</strong> #{{ticketId}}<br>
  <strong>Categoría:</strong> {{categoria}}<br>
  <strong>Solicitante:</strong> {{solicitanteNombre}}<br>
  <strong>Prioridad:</strong> {{prioridad}}<br>
  <strong>Descripción:</strong> {{descripcion}}
</div>
<p style="margin: 16px 0;">Por favor, haz clic en el siguiente botón para ver los detalles del ticket y comenzar a trabajar en él:</p>
<a href="{{ticketUrl}}" style="${btnStyle}">Ver Ticket</a>`;
  } else if (event === "ticket_actualizado") {
    subject = "Actualización de estatus: ticket #{{ticketId}}";
    contenido = `<h2 style="color: #1f2937; margin: 0 0 12px;">Hola {{solicitanteNombre}},</h2>
<p style="margin: 0 0 16px;">El ticket <strong>#{{ticketId}}</strong> ha cambiado de estado.</p>
<div style="background-color: #f9fafb; border-left: 4px solid #caab55; padding: 15px; margin: 15px 0;">
  <strong>ID del Ticket:</strong> #{{ticketId}}<br>
  <strong>Categoría:</strong> {{categoria}}<br>
  <strong>Nuevo estatus:</strong> <span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; font-weight: bold;">{{estatus}}</span><br>
  <strong>Descripción:</strong> {{descripcion}}
</div>
{{comentarioSection}}
<p style="margin: 16px 0;">Haz clic en el siguiente botón para ver el historial completo y detalles del ticket:</p>
<a href="{{ticketUrl}}" style="${btnStyle}">Ir al Ticket</a>`;
  } else if (event === "ticket_asignado") {
    subject = "Ticket reasignado #{{ticketId}}";
    contenido = `<h2 style="color: #1f2937; margin: 0 0 12px;">Hola {{agenteNombre}},</h2>
<p style="margin: 0 0 16px;">Se te ha <strong>reasignado</strong> el ticket <strong>#{{ticketId}}</strong> en el sistema.</p>
<div style="background-color: #f9fafb; border-left: 4px solid #caab55; padding: 15px; margin: 15px 0;">
  <strong>ID del Ticket:</strong> #{{ticketId}}<br>
  <strong>Categoría:</strong> {{categoria}}<br>
  <strong>Solicitante:</strong> {{solicitanteNombre}}<br>
  <strong>Prioridad:</strong> {{prioridad}}<br>
  <strong>Descripción:</strong> {{descripcion}}
</div>
<p style="margin: 16px 0;">Por favor, haz clic en el siguiente botón para ver los detalles del ticket:</p>
<a href="{{ticketUrl}}" style="${btnStyle}">Ver Ticket</a>`;
  } else if (event === "traslado_creado") {
    subject = "Nuevo traslado #TRL-{{ticketId}}";
    contenido = `<h2 style="color: #1f2937; margin: 0 0 12px;">Hola {{agenteNombre}},</h2>
<p style="margin: 0 0 16px;">Se ha iniciado un <strong>nuevo trámite de traslado</strong> en el sistema.</p>
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
<p style="margin: 16px 0;">Haz clic en el siguiente botón para auditar y gestionar este traslado:</p>
<a href="{{ticketUrl}}" style="${btnStyle}">Ver Traslado</a>`;
  }

  // Upsert: update existing template content (to apply inline styles) or create new one
  if (existing) {
    return await prisma.plantillaCorreo.update({
      where: { id: existing.id },
      data: { contenido }
    });
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
