import { prisma } from '../lib/db';
import type { Usuario, Rol } from '@prisma/client';

type AgentWithRelations = Usuario & { rol: Rol };

interface AssignmentOptions {
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
    const { solicitanteId, categoriaId, subcategoriaId } = options;

    console.log(`[Assignment] Buscando agente para categoría ${categoriaId}, subcategoría ${subcategoriaId}`);

    // PASO 1: Buscar asignaciones ESPECÍFICAS de usuario
    const specificAgents = await findAgentsBySpecificAssignment(categoriaId, subcategoriaId);

    if (specificAgents.length > 0) {
        const agent = await selectBestAgent(specificAgents, solicitanteId);
        if (agent) {
            console.log(`[Assignment] Agente encontrado por asignación específica: ${agent.id}`);
            return { agentId: agent.id, assignmentType: 'specific' };
        }
    }

    // PASO 2: Buscar por PERMISOS DE ROL
    const roleAgents = await findAgentsByRolePermissions(categoriaId, subcategoriaId);

    if (roleAgents.length > 0) {
        const agent = await selectBestAgent(roleAgents, solicitanteId);
        if (agent) {
            console.log(`[Assignment] Agente encontrado por permiso de rol: ${agent.id}`);
            return { agentId: agent.id, assignmentType: 'role' };
        }
    }

    // PASO 3: Fallback a lógica anterior
    console.warn(`[Assignment] No se encontraron permisos específicos, usando fallback`);
    const fallbackAgent = await findAgentByFallback(solicitanteId, categoriaId);

    if (fallbackAgent) {
        return { agentId: fallbackAgent, assignmentType: 'fallback' };
    }

    console.warn(`[Assignment] No se encontró ningún agente disponible`);
    return { agentId: null, assignmentType: 'none', reason: 'No agents available' };
}

/**
 * Busca agentes con asignación específica para la categoría/subcategoría
 */
async function findAgentsBySpecificAssignment(
    categoriaId: number,
    subcategoriaId?: number | null
): Promise<AgentWithRelations[]> {
    const assignments = await prisma.asignacionesCategorias.findMany({
        where: {
            activo: true,
            OR: buildCategorySubcategoryFilter(categoriaId, subcategoriaId),
        },
        include: {
            atiende: {
                include: { rol: true },
            },
        },
        orderBy: {
            prioridad: 'desc', // Mayor prioridad primero
        },
    });

    return assignments
        .map(a => a.atiende)
        .filter(u => u.activo && !u.vacaciones);
}

/**
 * Busca agentes cuyos roles tienen permiso para la categoría/subcategoría
 */
async function findAgentsByRolePermissions(
    categoriaId: number,
    subcategoriaId?: number | null
): Promise<AgentWithRelations[]> {
    const permissions = await prisma.permisoCategoria.findMany({
        where: {
            activo: true,
            OR: buildCategorySubcategoryFilter(categoriaId, subcategoriaId),
        },
        include: {
            rol: true,
        },
        orderBy: {
            prioridad: 'desc',
        },
    });

    if (permissions.length === 0) {
        return [];
    }

    const roleIds = [...new Set(permissions.map(p => p.rolId))];

    return await prisma.usuario.findMany({
        where: {
            activo: true,
            vacaciones: false,
            rolId: { in: roleIds },
        },
        include: { rol: true },
    });
}

/**
 * Construye el filtro OR para categoría/subcategoría
 */
function buildCategorySubcategoryFilter(
    categoriaId: number,
    subcategoriaId?: number | null
) {
    const filters: any[] = [];

    // Permiso específico a subcategoría
    if (subcategoriaId) {
        filters.push({
            categoriaId,
            subcategoriaId,
        });
    }

    // Permiso a categoría completa (subcategoriaId = null)
    filters.push({
        categoriaId,
        subcategoriaId: null,
    });

    return filters.filter(Boolean);
}

/**
 * Selecciona el mejor agente de una lista según:
 * 1. No sea el solicitante
 * 2. Esté en horario laboral
 * 3. Tenga menor carga de trabajo
 */
async function selectBestAgent(
    agents: AgentWithRelations[],
    solicitanteId: number
): Promise<AgentWithRelations | null> {
    // Filtrar solicitante
    const filtered = agents.filter(a => a.id !== solicitanteId);

    if (filtered.length === 0) {
        return null;
    }

    // Filtrar por horario
    const available = filterBySchedule(filtered);

    if (available.length === 0) {
        console.warn(`[Assignment] Ningún agente está en horario laboral`);
        // Opcional: Si nadie está en horario, ¿asignamos al de menor carga igual?
        // Por ahora retornamos null para que caiga en fallback o sin asignar
        return null;
    }

    // Ordenar por carga de trabajo
    available.sort((a, b) => a.carga_actual - b.carga_actual);

    return available[0];
}

/**
 * Filtra agentes según su horario laboral
 */
function filterBySchedule(agents: AgentWithRelations[]): AgentWithRelations[] {
    const now = new Date();
    const dayOfWeekName = now
        .toLocaleString('es-MX', { weekday: 'long', timeZone: 'America/Mexico_City' })
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const currentTime = now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Mexico_City'
    });

    return agents.filter(agent => {
        if (!agent.horario_disponibilidad || typeof agent.horario_disponibilidad !== 'object') {
            return false;
        }

        const schedule = agent.horario_disponibilidad as any;
        const daySchedule = schedule[dayOfWeekName];

        if (!daySchedule || !daySchedule.inicio || !daySchedule.fin) {
            return false;
        }

        return currentTime >= daySchedule.inicio && currentTime <= daySchedule.fin;
    });
}

/**
 * Lógica de fallback (mantiene compatibilidad con lógica anterior)
 */
async function findAgentByFallback(
    solicitanteId: number,
    categoriaId: number
): Promise<number | null> {
    // Aquí podríamos implementar una lógica simple de "asignar a cualquiera de soporte nivel 1"
    // o simplemente retornar null para que el ticket quede "Sin asignar"

    // Ejemplo simple: Buscar cualquier S_1 disponible
    const fallbackAgent = await prisma.usuario.findFirst({
        where: {
            activo: true,
            vacaciones: false,
            rol: {
                nivel_soporte: 'S_1'
            },
            id: { not: solicitanteId }
        },
        orderBy: {
            carga_actual: 'asc'
        }
    });

    return fallbackAgent ? fallbackAgent.id : null;
}
