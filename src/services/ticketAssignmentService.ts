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
    assignmentType: 'forced' | 'specific' | 'role' | 'none';
    reason?: string;
}

/**
 * Estrategia Híbrida de Asignación de Tickets (v2)
 *
 * Flujo de decisión:
 * 1. Contar TODOS los candidatos para la categoría/subcategoría (sin filtrar disponibilidad).
 * 2. Si hay exactamente 1 candidato → ASIGNACIÓN FORZADA (asigna aunque esté fuera de horario o con asignación desactivada).
 * 3. Si hay 2+ candidatos → buscar disponibles:
 *    a. Por asignación específica de usuario (AsignacionesCategorias)
 *    b. Por permisos de rol (PermisoCategoria)
 * 4. Si ningún candidato disponible → ticket SIN ASIGNAR.
 *
 * Reglas de disponibilidad (aplican en pasos 3a y 3b):
 * - activo: true
 * - acepta_tickets: true
 * - usuario.atiende_csh / usuario.atiende_mkt según la categoría
 * - horario_disponibilidad: DEBE estar definido y el agente debe estar dentro del rango actual.
 *   Un agente SIN horario definido se considera NO disponible.
 */
export async function findBestAgentHybrid(
    options: AssignmentOptions
): Promise<AssignmentResult> {
    const { solicitanteId, categoriaId, subcategoriaId } = options;
    const isMarketing = categoriaId === MARKETING_CATEGORY_ID;

    console.log(`[Assignment] Buscando agente para categoría ${categoriaId} (${isMarketing ? 'Marketing' : 'CSH'}), subcategoría ${subcategoriaId}`);

    // PASO 1: Contar todos los candidatos posibles (sin filtro de disponibilidad)
    const allCandidates = await findAllCandidates(categoriaId, subcategoriaId, isMarketing);

    // Excluir al solicitante del conteo para evitar auto-asignación
    const candidatesExcludingSelf = allCandidates.filter(a => a.id !== solicitanteId);

    console.log(`[Assignment] Total de candidatos para cat ${categoriaId}: ${candidatesExcludingSelf.length}`);

    // PASO 2: ASIGNACIÓN FORZADA — si solo hay un candidato posible, asignar sin importar disponibilidad
    if (candidatesExcludingSelf.length === 1) {
        const soleAgent = candidatesExcludingSelf[0];
        console.log(`[Assignment] Asignación forzada al único candidato: ${soleAgent.id}`);
        return { agentId: soleAgent.id, assignmentType: 'forced' };
    }

    // PASO 3: Hay 2+ candidatos → buscar disponibles
    if (candidatesExcludingSelf.length > 1) {
        // 3a: Asignaciones ESPECÍFICAS de usuario
        const specificAgents = await findAgentsBySpecificAssignment(categoriaId, subcategoriaId, isMarketing);
        const availableSpecific = filterByAvailability(specificAgents, solicitanteId);

        if (availableSpecific.length > 0) {
            const agent = selectByLowestLoad(availableSpecific);
            console.log(`[Assignment] Agente encontrado por asignación específica: ${agent.id}`);
            return { agentId: agent.id, assignmentType: 'specific' };
        }

        // 3b: Permisos de ROL
        const roleAgents = await findAgentsByRolePermissions(categoriaId, subcategoriaId, isMarketing);
        const availableRole = filterByAvailability(roleAgents, solicitanteId);

        if (availableRole.length > 0) {
            const agent = selectByLowestLoad(availableRole);
            console.log(`[Assignment] Agente encontrado por permiso de rol: ${agent.id}`);
            return { agentId: agent.id, assignmentType: 'role' };
        }
    }

    // PASO 4: Sin candidatos o ninguno disponible → sin asignar
    console.warn(`[Assignment] No se encontró ningún agente disponible para categoría ${categoriaId}`);
    return {
        agentId: null,
        assignmentType: 'none',
        reason: candidatesExcludingSelf.length === 0
            ? 'No hay ingenieros configurados para esta categoría'
            : 'Ningún ingeniero disponible en este momento (fuera de horario o con asignación desactivada)'
    };
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

/**
 * Obtiene TODOS los candidatos posibles para una categoría/subcategoría,
 * sin importar su disponibilidad actual. Combina asignaciones específicas
 * y permisos de rol para tener un conteo completo.
 */
async function findAllCandidates(
    catId: number,
    subId: number | null | undefined,
    isMarketing: boolean
): Promise<AgentWithRelations[]> {
    // Candidatos por asignación específica (activos, sin filtrar horario/acepta_tickets)
    const specificAssignments = await prisma.asignacionesCategorias.findMany({
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

    const specificUsers = specificAssignments
        .map(a => a.atiende)
        .filter(u => u && u.activo && hasCorrectUserFlag(u as AgentWithRelations, isMarketing)) as AgentWithRelations[];

    if (specificUsers.length > 0) {
        return specificUsers;
    }

    // Si no hay asignaciones específicas, buscar por permisos de rol
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

    const roleUsers = await prisma.usuario.findMany({
        where: {
            rolId: { in: roleIds },
            activo: true,
            ...(isMarketing
                ? { OR: [{ atiende_mkt: true }, { rol: { atiende_mkt: true } }] }
                : { OR: [{ atiende_csh: true }, { rol: { atiende_csh: true } }] })
        },
        include: { rol: true }
    });

    return roleUsers as AgentWithRelations[];
}

/**
 * Busca agentes con asignación específica a la categoría/subcategoría.
 * Solo retorna agentes activos con el flag de rol correcto (no filtra por disponibilidad de tiempo).
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
        .filter(u =>
            u &&
            u.activo &&
            u.acepta_tickets &&
            hasCorrectUserFlag(u as AgentWithRelations, isMarketing)
        ) as AgentWithRelations[];
}

/**
 * Busca agentes cuyos roles tienen permiso de atender la categoría/subcategoría.
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
            acepta_tickets: true,
            ...(isMarketing
                ? { OR: [{ atiende_mkt: true }, { rol: { atiende_mkt: true } }] }
                : { OR: [{ atiende_csh: true }, { rol: { atiende_csh: true } }] })
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
 * Filtra una lista de agentes aplicando:
 * 1. Excluir al solicitante (evitar auto-asignación)
 * 2. Verificar horario de disponibilidad (DEBE tener horario y estar dentro del rango actual)
 *
 * NOTA: Un agente SIN horario_disponibilidad definido se considera NO disponible
 * para asignación automática.
 */
function filterByAvailability(agents: AgentWithRelations[], solicitanteId: number): AgentWithRelations[] {
    const withoutSelf = agents.filter(a => a.id !== solicitanteId);
    return filterBySchedule(withoutSelf);
}

/**
 * Filtra agentes que estén dentro de su horario laboral al momento actual.
 *
 * REGLA: Si un agente NO tiene horario definido, se considera NO DISPONIBLE.
 * El horario es obligatorio para recibir tickets automáticamente.
 */
function filterBySchedule(agents: AgentWithRelations[]): AgentWithRelations[] {
    const now = new Date();

    const dayOfWeekName = now
        .toLocaleString('es-MX', { weekday: 'long', timeZone: 'America/Mexico_City' })
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const timeParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(now);

    const hour = timeParts.find(p => p.type === 'hour')?.value.padStart(2, '0') || '00';
    const minute = timeParts.find(p => p.type === 'minute')?.value.padStart(2, '0') || '00';
    const currentTime = `${hour}:${minute}`;

    return agents.filter(agent => {
        if (!agent.activo || !agent.acepta_tickets) {
            console.log(`[Assignment] Agente ${agent.id} ignorado: inactivo o no acepta tickets`);
            return false;
        }

        // Sin horario definido → NO disponible para asignación automática
        if (!agent.horario_disponibilidad || typeof agent.horario_disponibilidad !== 'object') {
            console.log(`[Assignment] Agente ${agent.id} ignorado: sin horario definido`);
            return false;
        }

        const schedule = agent.horario_disponibilidad as Record<string, { inicio?: string; fin?: string }>;
        const daySchedule = schedule[dayOfWeekName];

        // Sin datos para hoy → no trabaja hoy
        if (!daySchedule || !daySchedule.inicio || !daySchedule.fin) {
            console.log(`[Assignment] Agente ${agent.id} ignorado: no trabaja el día ${dayOfWeekName}`);
            return false;
        }

        const inSchedule = currentTime >= daySchedule.inicio && currentTime <= daySchedule.fin;
        if (!inSchedule) {
            console.log(`[Assignment] Agente ${agent.id} ignorado: fuera de horario (${currentTime} vs ${daySchedule.inicio}-${daySchedule.fin})`);
        }
        return inSchedule;
    });
}

/**
 * Selecciona el agente con menor carga de trabajo de una lista ya filtrada.
 * En caso de empate en carga_actual, desempata por ID ascendente.
 */
function selectByLowestLoad(agents: AgentWithRelations[]): AgentWithRelations {
    const sorted = [...agents].sort((a, b) => {
        if (a.carga_actual !== b.carga_actual) {
            return a.carga_actual - b.carga_actual;
        }
        return a.id - b.id;
    });
    return sorted[0];
}

/**
 * Verifica si el agente tiene el flag de usuario/rol correcto según el tipo de categoría.
 */
function hasCorrectUserFlag(agent: AgentWithRelations, isMarketing: boolean): boolean {
    if (isMarketing) {
        return agent.atiende_mkt === true || agent.rol?.atiende_mkt === true;
    }
    return agent.atiende_csh === true || agent.rol?.atiende_csh === true;
}
