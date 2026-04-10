import { PrismaClient } from '@prisma/client';
import type { Usuario, Rol } from '@prisma/client';

type AgentWithRelations = Usuario & { rol: Rol };

interface AssignmentOptions {
    db: PrismaClient;
    solicitanteId: number;
    categoriaId: number;
    subcategoriaId?: number | null;
}

interface AssignmentResult {
    agentId: number | null;
    assignmentType: 'specific' | 'role' | 'fallback' | 'none';
    reason?: string;
}

/**
 * Estrategia Híbrida de Asignación de Tickets
 * 
 * Prioridad:
 * 1. Asignaciones específicas de usuario (AsignacionesCategorias)
 * 2. Permisos de rol (PermisoCategoria)
 * 3. Fallback a lógica anterior (por nivel de soporte)
 */
export async function findBestAgentHybrid(
    options: AssignmentOptions
): Promise<AssignmentResult> {
    const { db, solicitanteId, categoriaId, subcategoriaId } = options;

    console.log(`[Assignment] Buscando agente para categoría ${categoriaId}, subcategoría ${subcategoriaId}`);

    // PASO 1: Buscar asignaciones ESPECÍFICAS de usuario
    const specificAgents = await findAgentsBySpecificAssignment(db, categoriaId, subcategoriaId);

    if (specificAgents.length > 0) {
        const agent = await selectBestAgent(specificAgents, solicitanteId, categoriaId);
        if (agent) {
            console.log(`[Assignment] Agente encontrado por asignación específica: ${agent.id}`);
            return { agentId: agent.id, assignmentType: 'specific' };
        }
    }

    // PASO 2: Buscar por PERMISOS DE ROL
    const roleAgents = await findAgentsByRolePermissions(db, categoriaId, subcategoriaId);

    if (roleAgents.length > 0) {
        const agent = await selectBestAgent(roleAgents, solicitanteId, categoriaId);
        if (agent) {
            console.log(`[Assignment] Agente encontrado por permiso de rol: ${agent.id}`);
            return { agentId: agent.id, assignmentType: 'role' };
        }
    }

    // PASO 3: Fallback (si no hay reglas, usar lógica default antigua)
    const fallbackId = await findAgentByFallback(db, solicitanteId, categoriaId);
    if (fallbackId) {
        console.log(`[Assignment] Agente encontrado por fallback: ${fallbackId}`);
        return { agentId: fallbackId, assignmentType: 'fallback' };
    }

    return { agentId: null, assignmentType: 'none', reason: 'No se encontraron agentes disponibles' };
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

async function findAgentsBySpecificAssignment(db: PrismaClient, catId: number, subId?: number | null): Promise<AgentWithRelations[]> {
    const assignments = await db.asignacionesCategorias.findMany({
        where: {
            categoriaId: catId,
            activo: true,
            ...(subId ? { OR: [{ subcategoriaId: subId }, { subcategoriaId: null }] } : { subcategoriaId: null })
        },
        include: {
            atiende: {
                include: { rol: true }
            }
        }
    });

    // Filtrar usuarios inactivos o vacacionando
    return assignments
        .map(a => a.atiende)
        .filter(u => u.activo && !u.vacaciones) as AgentWithRelations[];
}

async function findAgentsByRolePermissions(db: PrismaClient, catId: number, subId?: number | null): Promise<AgentWithRelations[]> {
    const permissions = await db.permisoCategoria.findMany({
        where: {
            categoriaId: catId,
            activo: true,
            ...(subId ? { OR: [{ subcategoriaId: subId }, { subcategoriaId: null }] } : { subcategoriaId: null })
        },
        select: { rolId: true }
    });

    if (permissions.length === 0) return [];

    const roleIds = permissions.map(p => p.rolId);

    const users = await db.usuario.findMany({
        where: {
            rolId: { in: roleIds },
            activo: true,
            vacaciones: false
        },
        include: { rol: true, asignaciones_categorias: true }
    });

    // Filtrar a los que tienen la AsignacionCategoria explícitamente en "activo: false" (excepción manual)
    return users.filter(user => {
        // ¿Revocó explícitamente la categoría entera?
        const explicitCat = user.asignaciones_categorias.find(a => a.categoriaId === catId && a.subcategoriaId === null);
        if (explicitCat && explicitCat.activo === false) return false;

        // ¿Revocó explícitamente la subcategoría específica?
        if (subId) {
            const explicitSub = user.asignaciones_categorias.find(a => a.categoriaId === catId && a.subcategoriaId === subId);
            if (explicitSub && explicitSub.activo === false) return false;
        }

        return true;
    }) as AgentWithRelations[];
}

/**
 * Selecciona el mejor agente de una lista según:
 * 1. No sea el solicitante
 * 2. Esté en horario laboral (excepto Marketing)
 * 3. Tenga menor carga de trabajo
 */
async function selectBestAgent(
    agents: AgentWithRelations[],
    solicitanteId: number,
    categoriaId: number
): Promise<AgentWithRelations | null> {
    // Filtrar solicitante
    const filtered = agents.filter(a => a.id !== solicitanteId);

    if (filtered.length === 0) {
        return null;
    }

    // Filtrar por horario (Ignorar para Marketing ID 12)
    const MARKETING_CATEGORY_ID = 12;
    let available = filtered;

    if (categoriaId !== MARKETING_CATEGORY_ID) {
        available = filterBySchedule(filtered);
    } else {
        // Para marketing, si queremos solo "activos" ya lo filtró el query anterior.
        // Podríamos agregar chequeo extra, pero asumimos activos.
    }

    if (available.length === 0) {
        return null; // Nadie disponible por horario
    }

    // Ordenar por carga de trabajo
    available.sort((a, b) => a.carga_actual - b.carga_actual);

    // Retornar el de menor carga
    return available[0];
}

/**
 * Filtra agentes según su horario laboral
 */
function filterBySchedule(agents: AgentWithRelations[]): AgentWithRelations[] {
    const now = new Date();
    // Obtener nombre del día en español (lunes, martes...)
    const dayOfWeekName = now
        .toLocaleString('es-MX', { weekday: 'long', timeZone: 'America/Mexico_City' })
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Remover acentos si hay

    const currentTime = now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Mexico_City'
    });

    return agents.filter(agent => {
        if (!agent.horario_disponibilidad || typeof agent.horario_disponibilidad !== 'object') {
            // Si no tiene horario definido, asumimos NO disponible o Disponible? 
            // La lógica previa era estricta: si no hay horario, no asigna.
            return false;
        }

        const schedule = agent.horario_disponibilidad as any;
        const daySchedule = schedule[dayOfWeekName];

        if (!daySchedule || !daySchedule.inicio || !daySchedule.fin) {
            return false; // No trabaja hoy
        }

        return currentTime >= daySchedule.inicio && currentTime <= daySchedule.fin;
    });
}

/**
 * Lógica de fallback (mantiene compatibilidad con lógica anterior)
 */
async function findAgentByFallback(
    db: PrismaClient,
    solicitanteId: number,
    categoriaId: number
): Promise<number | null> {
    // Si la categoría es Marketing (12), NO hacer fallback al equipo general de CSH.
    if (categoriaId === 12) {
        return null;
    }

    // Buscar agentes de soporte general (S-1) que estén disponibles
    const fallbackAgents = await db.usuario.findMany({
        where: {
            activo: true,
            vacaciones: false,
            rol: {
                nivel_soporte: 'S_1' // Usar string literal exacto del enum
            },
            id: { not: solicitanteId }
        },
        include: { rol: true },
        orderBy: {
            carga_actual: 'asc'
        }
    });

    // Validar horario también para ellos
    const available = filterBySchedule(fallbackAgents as AgentWithRelations[]);

    return available.length > 0 ? available[0].id : null;
}
