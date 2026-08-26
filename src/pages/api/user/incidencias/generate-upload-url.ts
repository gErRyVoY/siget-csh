import type { APIRoute } from "astro";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

if (
  !process.env.S3_BUCKET_NAME ||
  !process.env.S3_REGION ||
  !process.env.S3_ACCESS_KEY_ID ||
  !process.env.S3_SECRET_ACCESS_KEY
) {
  throw new Error("Las variables de entorno de S3 no están configuradas correctamente.");
}

const s3Client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

export const POST: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
  if (!session || !session.user) {
    return new Response(JSON.stringify({ message: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { fileName, fileType, mes, anio } = await request.json();
    const userId = parseInt(session.user.id as string, 10);

    if (!fileName || !fileType || !mes || !anio) {
      return new Response(
        JSON.stringify({
          message: "Faltan parámetros requeridos (fileName, fileType, mes, anio)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Clean filename
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    // Path: reportes/[id-usuario]/incidencias/[año]/[mes]/[timestamp]-[fileName]
    const key = `reportes/${userId}/incidencias/${anio}/${mes}/${Date.now()}-${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    return new Response(JSON.stringify({ uploadUrl, key }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error al generar URL de firma para incidencias:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
