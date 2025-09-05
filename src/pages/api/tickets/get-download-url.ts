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

export const POST: APIRoute = async ({ request }) => {
    const session = await getSession(request);
    if (!session || !session.user) {
        return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 403 });
    }

    try {
        const { key } = await request.json();

        if (!key) {
            return new Response(JSON.stringify({ message: 'Falta el parámetro requerido (key)' }), { status: 400 });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
        });

        // Generate the pre-signed URL for download
        const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL is valid for 1 hour

        return new Response(JSON.stringify({ downloadUrl }), { status: 200 });

    } catch (error) {
        console.error('Error generating pre-signed URL for download:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor' }), { status: 500 });
    }
};