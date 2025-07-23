// Importa el tipo APIContext para obtener tipado fuerte en los parámetros de la función.
import type { APIContext } from 'astro';

/**
 * @description
 * Esta función maneja las solicitudes GET a la ruta /health.
 * Devuelve un objeto JSON simple para indicar que el servicio está funcionando correctamente.
 * Es comúnmente usado como un "health check" por servicios de monitoreo.
 */
export async function GET(context: APIContext) {
    // 1. Prepara los datos que se enviarán como respuesta.
    const data = { status: 'ok' };

    // 2. Crea y devuelve una nueva instancia de Response.
    //    - El primer argumento es el cuerpo de la respuesta, que debe ser un string.
    //      Por eso usamos JSON.stringify().
    //    - El segundo argumento es un objeto de configuración donde definimos
    //      el código de estado (status) y las cabeceras (headers).
    return new Response(JSON.stringify(data), {
        status: 200, // OK
        headers: {
            'Content-Type': 'application/json'
        }
    });
}