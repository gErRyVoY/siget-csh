import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Sincronizando secuencias de PostgreSQL...');

  // 1. Get all sequences in the public schema and generate SETVAL statements
  const getSequencesQuery = `
    SELECT 
      pg_get_serial_sequence('"' || table_schema || '"."' || table_name || '"', column_name) as seq_name,
      table_name,
      column_name
    FROM information_schema.columns
    WHERE column_default LIKE 'nextval%'
      AND table_schema = 'public';
  `;

  const sequences = await prisma.$queryRaw<Array<{ seq_name: string | null; table_name: string; column_name: string }>>`
    SELECT 
      pg_get_serial_sequence('"' || table_name || '"', column_name) as seq_name,
      table_name,
      column_name
    FROM information_schema.columns
    WHERE column_default LIKE 'nextval%'
      AND table_schema = 'public';
  `;

  for (const seq of sequences) {
    if (!seq.seq_name) {
      console.log(`Saltando tabla ${seq.table_name} (sin secuencia serial encontrada)`);
      continue;
    }

    console.log(`Sincronizando secuencia para tabla: ${seq.table_name} (Columna: ${seq.column_name})`);

    // Reset sequence to the MAX(id) + 1 (or 1 if no records exist)
    const resetQuery = `
      SELECT setval(
        '${seq.seq_name}', 
        COALESCE((SELECT MAX("${seq.column_name}") FROM "${seq.table_name}"), 0) + 1, 
        false
      );
    `;

    try {
      await prisma.$executeRawUnsafe(resetQuery);
      console.log(`  ✓ Secuencia ${seq.seq_name} sincronizada.`);
    } catch (err: any) {
      console.error(`  ✗ Error sincronizando ${seq.seq_name}:`, err.message);
    }
  }

  console.log('¡Sincronización terminada!');
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
