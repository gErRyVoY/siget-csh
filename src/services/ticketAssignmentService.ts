import { prisma } from '../lib/db';
import type { Prisma, Usuario, Rol } from '@prisma/client';
import { MARKETING_CATEGORY_ID } from '@/config/ticket-categories';

type AgentWithRelations = Usuario & { rol: Rol };

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
 * 0. Si la categoría es Marketing → SIN ASIGNAR (el equipo hace el triaje a mano).
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

    // PASO 0: Marketing no se reparte solo. El equipo decide quién toma cada
    // pieza, así que el alta nunca asigna y el ticket entra «Sin asignar»; a
    // partir de ahí un admin de Marketing se lo asigna o lo asigna a alguien
    // (ver `canAssignMarketingTickets`). Sin este corte el PASO 2 asignaba a la
    // fuerza en cuanto quedaba un único candidato, ignorando horario y
    // `acepta_tickets`.
    if (isMarketing) {
        console.log('[Assignment] Categoría de Marketing: se deja sin asignar para triaje manual');
        return {
            agentId: null,
            assignmentType: 'none',
            reason: 'Los tickets de Marketing se asignan manualmente'
        };
    }

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
    // Candidatos por asignación específica (sin filtrar horario/acepta_tickets)
    const specificUsers = await resolveSpecificAgents(catId, subId, isMarketing);

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
    const agents = await resolveSpecificAgents(catId, subId, isMarketing);
    return agents.filter(u => u.acepta_tickets);
}

/**
 * Devuelve, SIN DUPLICADOS, los agentes con asignación específica activa a la
 * categoría/subcategoría indicada.
 *
 * Un mismo agente puede tener varias filas en `asignaciones_categorias` para la misma
 * categoría: una a nivel categoría (`subcategoriaId = null`), otra por subcategoría y —en
 * datos heredados— incluso filas repetidas de la misma pareja. Antes se devolvía una entrada
 * por fila, así que un único ingeniero contaba como varios candidatos: el PASO 2 (asignación
 * forzada al único candidato) no se disparaba y el ticket caía al filtro de horario, quedando
 * sin asignar. Es exactamente lo que le pasó al ticket 35, con cuatro filas activas
 * apuntando todas al mismo ingeniero.
 *
 * Precedencia: la fila de la subcategoría concreta manda sobre la de la categoría, de modo
 * que una revocación puntual no queda tapada por el permiso general. Por eso el `activo` se
 * resuelve aquí y no en el `where`.
 */
async function resolveSpecificAgents(
    catId: number,
    subId: number | null | undefined,
    isMarketing: boolean
): Promise<AgentWithRelations[]> {
    const assignments = await prisma.asignacionesCategorias.findMany({
        where: {
            categoriaId: catId,
            ...(subId ? { OR: [{ subcategoriaId: subId }, { subcategoriaId: null }] } : { subcategoriaId: null })
        },
        include: {
            atiende: {
                include: { rol: true }
            }
        }
    });

    // Por agente: qué dice la fila de categoría y qué dice la de subcategoría.
    const porAgente = new Map<number, { agent: AgentWithRelations; nivelCategoria?: boolean; nivelSubcategoria?: boolean }>();

    for (const a of assignments) {
        const agent = a.atiende as AgentWithRelations | null;
        if (!agent) continue;

        const entry = porAgente.get(agent.id) ?? { agent };
        if (a.subcategoriaId === null) {
            // Con filas repetidas al mismo nivel, basta una activa para conceder.
            entry.nivelCategoria = entry.nivelCategoria || a.activo;
        } else {
            entry.nivelSubcategoria = entry.nivelSubcategoria || a.activo;
        }
        porAgente.set(agent.id, entry);
    }

    return Array.from(porAgente.values())
        .filter(({ nivelCategoria, nivelSubcategoria }) =>
            nivelSubcategoria !== undefined ? nivelSubcategoria : nivelCategoria === true
        )
        .map(({ agent }) => agent)
        .filter(agent => agent.activo && hasCorrectUserFlag(agent, isMarketing));
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

/**
 * ¿Es esta persona del equipo que hace el triaje de Marketing?
 *
 * Como los tickets de Marketing entran siempre «Sin asignar» (ver PASO 0 de
 * `findBestAgentHybrid`), alguien tiene que poder darles salida. Ese alguien es
 * quien cumple las dos condiciones que se administran en
 * `/admin/usuarios/editar/<id>`:
 *
 * 1. Tiene la categoría de Marketing asignada y activa en `asignaciones_categorias`
 *    —por la categoría entera o por alguna de sus subcategorías—.
 * 2. Tiene «Atiende Mkt» (`atiende_mkt`), propio o heredado del rol, igual que
 *    exige `hasCorrectUserFlag` para cualquier asignación de Marketing.
 *
 * Quien no cumple (2) no puede ser destino de una asignación de Marketing, así
 * que tampoco tiene sentido que reparta los tickets de los demás.
 *
 * El rol se comprueba en la vista y en el endpoint, no aquí: esta función
 * responde «¿es del equipo de Marketing?», no «¿es admin?».
 */
export async function canAssignMarketingTickets(usuarioId: number): Promise<boolean> {
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) return false;

    const usuario = await prisma.usuario.findFirst({
        where: {
            id: usuarioId,
            activo: true,
            OR: [{ atiende_mkt: true }, { rol: { atiende_mkt: true } }],
            asignaciones_categorias: {
                some: {
                    activo: true,
                    OR: [
                        { categoriaId: MARKETING_CATEGORY_ID },
                        // Filas que sólo fijan subcategoría: cuentan por la
                        // categoría de la que cuelga esa subcategoría.
                        {
                            categoriaId: null,
                            subcategoria: {
                                subcategoria_categorias: { some: { categoriaId: MARKETING_CATEGORY_ID } }
                            }
                        }
                    ]
                }
            }
        },
        select: { id: true }
    });

    return usuario !== null;
}

/**
 * `where` de los agentes que pueden recibir un ticket de esta categoría POR MANO.
 *
 * Las asignaciones de categorías (`asignaciones_categorias`) sólo gobiernan el
 * reparto AUTOMÁTICO: dicen a quién le puede caer un ticket solo. La asignación
 * manual es más ancha a propósito —cualquier ingeniero de la cola puede tomar un
 * ticket sin asignar, y un superadmin puede reasignarlo a quien haga falta—, así
 * que aquí basta con estar activo y atender la cola (`atiende_csh`/`atiende_mkt`).
 *
 * Se mantiene la segunda rama del OR para no perder a quien tiene la categoría
 * asignada pero se quedó sin el flag: si figura como responsable de la categoría,
 * debe poder recibirla a mano.
 *
 * Esta función es la ÚNICA fuente de verdad del desplegable «Atiende»
 * (src/pages/tickets/view/[id].astro) y de `canAgentBeAssignedManually`. Cuando
 * eran dos criterios distintos, el desplegable ofrecía 41 de 125 candidatos que
 * el PATCH luego rechazaba con 400.
 */
export function buildManuallyAssignableWhere(
    categoriaId: number,
    subcategoriaId: number | null,
    isMarketing: boolean
): Prisma.UsuarioWhereInput {
    return {
        activo: true,
        OR: [
            isMarketing ? { atiende_mkt: true } : { atiende_csh: true },
            {
                asignaciones_categorias: {
                    some: {
                        categoriaId,
                        OR: [
                            { subcategoriaId },
                            { subcategoriaId: null }
                        ],
                        activo: true
                    }
                }
            }
        ]
    };
}

/**
 * Verifica si un agente puede ser asignado MANUALMENTE a un ticket de una categoría/subcategoría dada.
 *
 * Criterios para asignación manual (ver `buildManuallyAssignableWhere`):
 * 1. El agente está activo (`activo === true`).
 * 2. Atiende la cola: flag `atiende_csh`/`atiende_mkt` según la categoría, o
 *    tiene esa categoría/subcategoría asignada y activa.
 *
 * NO se exige tener la categoría habilitada: eso es requisito del reparto
 * automático, no del manual. Tampoco se toma en cuenta `acepta_tickets`,
 * `carga_actual` ni `horario_disponibilidad`.
 */
export async function canAgentBeAssignedManually(
    agentId: number,
    categoriaId: number,
    subcategoriaId?: number | null
): Promise<{ canAssign: boolean; reason?: string }> {
    const isMarketing = categoriaId === MARKETING_CATEGORY_ID;

    const agent = await prisma.usuario.findFirst({
        where: {
            id: agentId,
            ...buildManuallyAssignableWhere(categoriaId, subcategoriaId ?? null, isMarketing)
        },
        select: { id: true }
    });

    if (agent) return { canAssign: true };

    // No pasó el filtro: distinguir «inactivo» de «no atiende esta cola» para que
    // el 400 diga algo accionable.
    const exists = await prisma.usuario.findUnique({
        where: { id: agentId },
        select: { activo: true }
    });

    if (!exists || !exists.activo) {
        return { canAssign: false, reason: 'El usuario seleccionado no está activo' };
    }

    return {
        canAssign: false,
        reason: `El usuario no tiene habilitado atender tickets de ${isMarketing ? 'Marketing' : 'CSH'}`
    };
}
