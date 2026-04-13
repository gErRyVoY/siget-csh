
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

    // 1. Find the correct cycle for today
    const correctCycle = await prisma.ciclo.findFirst({
        where: {
            fecha_inicio: { lte: now },
            fecha_fin: { gte: now }
        }
    });

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
        await prisma.ciclo.updateMany({
            where: {
                activo: true,
                id: { not: correctCycle.id }
            },
            data: { activo: false }
        });

        return correctCycle;
    } else {
        // No cycle matches today (Gap period or Out of range)
        // Ensure everything is inactive
        const deleted = await prisma.ciclo.updateMany({
            where: { activo: true },
            data: { activo: false }
        });
        if (deleted.count > 0) {
            console.log(`[CycleService] No active cycle for today. Deactivated ${deleted.count} cycles.`);
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
