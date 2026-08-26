import pkg from '@prisma/client';
import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { recordQuery } from './perf';

const { PrismaClient } = pkg;

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

function createPrismaClient(): PrismaClientType {
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  // En desarrollo emitimos `query` como evento para poder contar las sentencias
  // SQL reales por petición (ver src/lib/perf.ts y la cabecera Server-Timing).
  // El log a stdout se mantiene igual que antes; `PRISMA_QUERY_LOG=off` lo silencia
  // cuando solo interesa el conteo.
  const client = new PrismaClient({
    log: [{ emit: 'event', level: 'query' }, 'info', 'warn', 'error'],
  });

  const logQueries = process.env.PRISMA_QUERY_LOG !== 'off';

  client.$on('query', (event) => {
    recordQuery(event.duration);
    if (logQueries) {
      console.log(`prisma:query ${event.query} ${event.params} +${event.duration}ms`);
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
