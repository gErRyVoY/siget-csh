/**
 * Adaptador de Compatibilidad para Prisma
 * 
 * NOTA: La arquitectura de SiGeT V2 migró a Inyección de Dependencias a través
 * de Astro Locals para ser compatible con Cloudflare D1 en Edge.
 * 
 * Sin embargo, archivos globales (como \`auth.config.ts\`) que se inicializan fuera
 * del contexto directo de las vistas necesitan acceso a de DB de alguna manera.
 * 
 * Por ello, \`middleware.ts\` intercepta las peticiones y deposita la BD
 * adaptada correctamete en \`globalThis.edgeDb\`.
 * Este archivo actúa como un Proxy que intercepta las llamadas globales de Prisma
 * y las redirige al objeto instanciado (D1 o Local) para no romper las importaciones existentes.
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new Proxy({} as PrismaClient, {
  get: function (target, prop) {
    const activeDb = (globalThis as any).edgeDb;
    
    if (!activeDb) {
      // Fallback estricto por si se intenta leer la BD fuera de una petición
      // (por ejemplo scripts crudos o workers en background locales)
      console.warn("⚠️ Acceso a Prisma desde globalThis.edgeDb no encontrado. Creando instancia de fallback (No D1).");
      const fallback = new PrismaClient();
      (globalThis as any).edgeDb = fallback;
      return fallback[prop as keyof PrismaClient];
    }

    return activeDb[prop];
  }
});
