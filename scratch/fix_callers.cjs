const fs = require('fs');

function fixTransfer() {
  const file = 'src/pages/api/tickets/transfer.ts';
  let content = fs.readFileSync(file, 'utf-8');
  
  // Clean import and inject locals
  content = content.replace(/import\s*\{\s*prisma\s*\}\s*from\s+['\"].*lib\/db['\"];?\r?\n?/g, '');
  content = content.replace(/export\s+const\s+POST\s*:\s*APIRoute\s*=\s*async\s*\(\{\s*locals,\s*request\s*\}\)\s*=>\s*\{/, 'export const POST: APIRoute = async (context) => {\n  const { request, locals } = context;\n  const { db } = locals;\n');
  content = content.replace(/export\s+const\s+POST\s*:\s*APIRoute\s*=\s*async\s*\(\{\s*request\s*\}\)\s*=>\s*\{/, 'export const POST: APIRoute = async (context) => {\n  const { request, locals } = context;\n  const { db } = locals;\n');

  
  // En case el file anterior ya fue parcialmente reescrito o checkout de git, 
  content = content.replace(/\bprisma\./g, 'db.');

  // Param injections
  content = content.replace(/ensureActiveCycle\(\)/g, 'ensureActiveCycle(db)');
  content = content.replace(/findBestAgentHybrid\(\{/g, 'findBestAgentHybrid({\n            db,');
  
  fs.writeFileSync(file, content);
  console.log('Fixed transfer.ts');
}

function fixCreate() {
  const file = 'src/pages/api/tickets/create.ts';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/ensureActiveCycle\(\)/g, 'ensureActiveCycle(db)');
  content = content.replace(/findBestAgentHybrid\(\{/g, 'findBestAgentHybrid({\n            db,');
  fs.writeFileSync(file, content);
  console.log('Fixed create.ts');
}

function fixCiclos() {
  const file = 'src/pages/admin/ciclos/index.astro';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/getActiveCycle\(\)/g, 'getActiveCycle(db)');
  fs.writeFileSync(file, content);
  console.log('Fixed ciclos/index.astro');
}

fixTransfer();
fixCreate();
fixCiclos();
