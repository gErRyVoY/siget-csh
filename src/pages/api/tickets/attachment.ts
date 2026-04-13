import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export const GET: APIRoute = async ({ request, url }) => {
    const session = await getSession(request);
    if (!session || !session.user) {
        return new Response('No autorizado', { status: 403 });
    }

    try {
        const key = url.searchParams.get("key");

        if (!key) {
            return new Response('Falta el parámetro requerido (key)', { status: 400 });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
        });

        // Generate the pre-signed URL for download
        const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL is valid for 1 hour

        // Redirect to the S3 URL
        return Response.redirect(downloadUrl);

    } catch (error) {
        console.error('Error generating pre-signed URL for download:', error);
        return new Response('Error interno del servidor', { status: 500 });
    }
};
