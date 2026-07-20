import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw<Array<{table_name: string, column_name: string, data_type: string, column_default: string | null}>>`
    SELECT table_name, column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('usuario', 'rol', 'empresa')
    ORDER BY table_name, ordinal_position
  `;

  const byTable: Record<string, string[]> = {};
  for (const row of result) {
    if (!byTable[row.table_name]) byTable[row.table_name] = [];
    byTable[row.table_name].push(row.column_name);
  }

  console.log('\n=== Columnas en la BD restaurada ===');
  for (const [table, cols] of Object.entries(byTable)) {
    console.log(`\n[${table}]`);
    cols.forEach(c => console.log(`  - ${c}`));
  }
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
