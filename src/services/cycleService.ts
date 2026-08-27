
import { prisma } from '@/lib/db';

/**
 * Ensures that the 'activo' flag in the Ciclo table is consistent with the current date.
 * Steps:
 * 1. Find the cycle that SHOULD be active (now() between start and end).
 * 2. If it's not active, activate it.
 * 3. Deactivate any other cycles that are currently active but shouldn't be.
 * 4. Return the active cycle query result.
 */
export async function ensureActiveCycle() {
    const now = new Date();

    // Se corre en cada creación de ticket y en cada traslado, y en el estado normal
    // —el ciclo correcto ya es el único activo— no hay nada que corregir. Por eso las
    // dos lecturas van en paralelo (un solo viaje a la BD) y las escrituras quedan
    // condicionadas a que realmente haya algo que cambiar: antes se emitía un UPDATE
    // de desactivación en toda llamada, con su bloqueo de fila, aunque no tocara nada.
    const [correctCycle, activos] = await Promise.all([
        prisma.ciclo.findFirst({
            where: {
                fecha_inicio: { lte: now },
                fecha_fin: { gte: now }
            }
        }),
        prisma.ciclo.findMany({
            where: { activo: true },
            select: { id: true }
        }),
    ]);

    if (correctCycle) {
        // If the correct cycle is not active, activate it
        if (!correctCycle.activo) {
            console.log(`[CycleService] Activating cycle ${correctCycle.ciclo}`);
            await prisma.ciclo.update({
                where: { id: correctCycle.id },
                data: { activo: true }
            });
        }

        // Deactivate others
        const sobrantes = activos.map(c => c.id).filter(id => id !== correctCycle.id);
        if (sobrantes.length > 0) {
            await prisma.ciclo.updateMany({
                where: { id: { in: sobrantes } },
                data: { activo: false }
            });
        }

        return correctCycle;
    } else {
        // No cycle matches today (Gap period or Out of range)
        // Ensure everything is inactive
        if (activos.length > 0) {
            const { count } = await prisma.ciclo.updateMany({
                where: { id: { in: activos.map(c => c.id) } },
                data: { activo: false }
            });
            console.log(`[CycleService] No active cycle for today. Deactivated ${count} cycles.`);
        }
        return null;
    }
}

/**
 * Gets the active cycle, ensuring consistency first.
 */
export async function getActiveCycle() {
    return await ensureActiveCycle();
}
