import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.usuario.update({
    where: { id: 3 },
    data: { tckt_csh: true, tckt_mkt: true },
  });
  console.log(`✅ Restaurado: ${user.nombres} ${user.apellidos} | tckt_csh: ${user.tckt_csh} | tckt_mkt: ${user.tckt_mkt}`);
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
