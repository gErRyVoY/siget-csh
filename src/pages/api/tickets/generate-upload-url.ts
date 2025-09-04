import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { prisma } from '@/lib/db';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PRIVILEGED_ROLES = [1, 2, 3, 4, 5, 6, 15];

// Ensure environment variables are set
if (!process.env.S3_BUCKET_NAME || !process.env.S3_REGION || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error("Las variables de entorno de S3 no están configuradas correctamente.");
}

const s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
});

export const POST: APIRoute = async ({ request }) => {
    const session = await getSession(request);
    if (!session || !session.user || !PRIVILEGED_ROLES.includes(session.user.rol?.id ?? -1)) {
        return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 403 });
    }

    try {
        const { fileName, fileType, ticketId } = await request.json();

        if (!fileName || !fileType || !ticketId) {
            return new Response(JSON.stringify({ message: 'Faltan parámetros requeridos (fileName, fileType, ticketId)' }), { status: 400 });
        }

        // Fetch ticket to get company slug for folder structure
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: { empresa: { select: { slug: true } } },
        });

        if (!ticket) {
            return new Response(JSON.stringify({ message: 'Ticket no encontrado' }), { status: 404 });
        }

        // Create a unique key for the S3 object
        const key = `tickets/${ticket.empresa.slug}/${ticket.id}/${Date.now()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            ContentType: fileType,
        });

        // Generate the pre-signed URL
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 }); // URL is valid for 60 seconds

        return new Response(JSON.stringify({ uploadUrl, key }), { status: 200 });

    } catch (error) {
        console.error('Error generating pre-signed URL:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
    }
};
