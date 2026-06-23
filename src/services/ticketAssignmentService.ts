import { prisma } from '../lib/db';
import type { Usuario, Rol } from '@prisma/client';

type AgentWithRelations = Usuario & { rol: Rol };

/** ID de la categoría Marketing en BD */
const MARKETING_CATEGORY_ID = 12;

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
 * 3. Fallback a lógica default (S-1 para tickets CSH)
 *
 * En todos los pasos se validan:
 * - activo: true
 * - vacaciones: false
 * - rol.atiendeTicketsCsh / rol.atiendeTicketsMkt según la categoría
 * - horario_disponibilidad (si está definido, debe estar dentro del rango)
 */
export async function findBestAgentHybrid(
    options: AssignmentOptions
): Promise<AssignmentResult> {
    const { solicitanteId, categoriaId, subcategoriaId } = options;
    const isMarketing = categoriaId === MARKETING_CATEGORY_ID;

    console.log(`[Assignment] Buscando agente para categoría ${categoriaId} (${isMarketing ? 'Marketing' : 'CSH'}), subcategoría ${subcategoriaId}`);

    // PASO 1: Buscar asignaciones ESPECÍFICAS de usuario
    const specificAgents = await findAgentsBySpecificAssignment(categoriaId, subcategoriaId, isMarketing);

    if (specificAgents.length > 0) {
        const agent = await selectBestAgent(specificAgents, solicitanteId, isMarketing);
        if (agent) {
            console.log(`[Assignment] Agente encontrado por asignación específica: ${agent.id}`);
            return { agentId: agent.id, assignmentType: 'specific' };
        }
    }

    // PASO 2: Buscar por PERMISOS DE ROL
    const roleAgents = await findAgentsByRolePermissions(categoriaId, subcategoriaId, isMarketing);

    if (roleAgents.length > 0) {
        const agent = await selectBestAgent(roleAgents, solicitanteId, isMarketing);
        if (agent) {
            console.log(`[Assignment] Agente encontrado por permiso de rol: ${agent.id}`);
            return { agentId: agent.id, assignmentType: 'role' };
        }
    }

    // PASO 3: Fallback (solo para CSH general, nunca para Marketing)
    const fallbackId = await findAgentByFallback(solicitanteId, isMarketing);
    if (fallbackId) {
        console.log(`[Assignment] Agente encontrado por fallback: ${fallbackId}`);
        return { agentId: fallbackId, assignmentType: 'fallback' };
    }

    console.warn(`[Assignment] No se encontró ningún agente disponible para categoría ${categoriaId}`);
    return { agentId: null, assignmentType: 'none', reason: 'No se encontraron agentes disponibles' };
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

/**
 * Busca agentes con asignación específica a la categoría/subcategoría,
 * filtrando por disponibilidad real (activo, vacaciones, flag de rol).
 */
async function findAgentsBySpecificAssignment(
    catId: number,
    subId: number | null | undefined,
    isMarketing: boolean
): Promise<AgentWithRelations[]> {
    const assignments = await prisma.asignacionesCategorias.findMany({
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

    return assignments
        .map(a => a.atiende)
        .filter(u => isAgentAvailable(u as AgentWithRelations, isMarketing)) as AgentWithRelations[];
}

/**
 * Busca agentes cuyos roles tienen permiso de atender la categoría/subcategoría,
 * filtrando por disponibilidad real y flag de atención.
 */
async function findAgentsByRolePermissions(
    catId: number,
    subId: number | null | undefined,
    isMarketing: boolean
): Promise<AgentWithRelations[]> {
    const permissions = await prisma.permisoCategoria.findMany({
        where: {
            categoriaId: catId,
            activo: true,
            ...(subId ? { OR: [{ subcategoriaId: subId }, { subcategoriaId: null }] } : { subcategoriaId: null })
        },
        select: { rolId: true }
    });

    if (permissions.length === 0) return [];

    const roleIds = permissions.map(p => p.rolId);

    const users = await prisma.usuario.findMany({
        where: {
            rolId: { in: roleIds },
            activo: true,
            vacaciones: false,
            // Filtrar por el flag del rol según tipo de categoría
            rol: isMarketing
                ? { atiendeTicketsMkt: true }
                : { atiendeTicketsCsh: true }
        },
        include: { rol: true, asignaciones_categorias: true }
    });

    // Excluir a quienes tienen revocada explícitamente la categoría o subcategoría
    return users.filter(user => {
        const explicitCat = user.asignaciones_categorias.find(
            a => a.categoriaId === catId && a.subcategoriaId === null
        );
        if (explicitCat && explicitCat.activo === false) return false;

        if (subId) {
            const explicitSub = user.asignaciones_categorias.find(
                a => a.categoriaId === catId && a.subcategoriaId === subId
            );
            if (explicitSub && explicitSub.activo === false) return false;
        }

        return true;
    }) as AgentWithRelations[];
}

/**
 * Selecciona el mejor agente de una lista según:
 * 1. No sea el solicitante
 * 2. Esté en horario laboral (si tiene horario definido)
 * 3. Tenga menor carga de trabajo
 */
async function selectBestAgent(
    agents: AgentWithRelations[],
    solicitanteId: number,
    isMarketing: boolean
): Promise<AgentWithRelations | null> {
    // Filtrar al solicitante para evitar auto-asignación
    const filtered = agents.filter(a => a.id !== solicitanteId);

    if (filtered.length === 0) return null;

    // Para Marketing, no se valida horario (pueden operar en distintos turnos)
    // Para CSH, validar horario solo si el agente tiene uno definido
    const available = isMarketing
        ? filtered
        : filterBySchedule(filtered);

    if (available.length === 0) return null;

    // Ordenar por carga de trabajo ascendente y retornar el de menor carga
    available.sort((a, b) => a.carga_actual - b.carga_actual);
    return available[0];
}

/**
 * Filtra agentes que estén dentro de su horario laboral al momento actual.
 * Si un agente NO tiene horario definido, se considera DISPONIBLE (sin restricción).
 */
function filterBySchedule(agents: AgentWithRelations[]): AgentWithRelations[] {
    const now = new Date();

    // Obtener nombre del día en español sin acentos (lunes, martes, ...)
    const dayOfWeekName = now
        .toLocaleString('es-MX', { weekday: 'long', timeZone: 'America/Mexico_City' })
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const currentTime = now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Mexico_City'
    });

    return agents.filter(agent => {
        // Sin horario definido → disponible sin restricción
        if (!agent.horario_disponibilidad || typeof agent.horario_disponibilidad !== 'object') {
            return true;
        }

        const schedule = agent.horario_disponibilidad as Record<string, { inicio?: string; fin?: string }>;
        const daySchedule = schedule[dayOfWeekName];

        // Sin datos para hoy → no trabaja hoy
        if (!daySchedule || !daySchedule.inicio || !daySchedule.fin) {
            return false;
        }

        return currentTime >= daySchedule.inicio && currentTime <= daySchedule.fin;
    });
}

/**
 * Fallback: busca agentes de soporte S-1 con el flag atiendeTicketsCsh activo.
 * Solo aplica para tickets de CSH; Marketing nunca usa este fallback.
 */
async function findAgentByFallback(
    solicitanteId: number,
    isMarketing: boolean
): Promise<number | null> {
    // Marketing nunca hace fallback al equipo de CSH
    if (isMarketing) return null;

    const fallbackAgents = await prisma.usuario.findMany({
        where: {
            activo: true,
            vacaciones: false,
            id: { not: solicitanteId },
            rol: {
                nivel_soporte: 'S_1',
                atiendeTicketsCsh: true
            }
        },
        include: { rol: true },
        orderBy: { carga_actual: 'asc' }
    });

    const available = filterBySchedule(fallbackAgents as AgentWithRelations[]);
    return available.length > 0 ? available[0].id : null;
}

/**
 * Validación centralizada de disponibilidad de un agente.
 * Verifica: activo, no en vacaciones, y flag correcto del rol.
 */
function isAgentAvailable(agent: AgentWithRelations, isMarketing: boolean): boolean {
    if (!agent.activo || agent.vacaciones) return false;
    if (isMarketing && !agent.rol.atiendeTicketsMkt) return false;
    if (!isMarketing && !agent.rol.atiendeTicketsCsh) return false;
    return true;
}
