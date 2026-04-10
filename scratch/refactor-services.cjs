const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  try {
     const list = fs.readdirSync(dir);
     list.forEach(file => {
       file = path.join(dir, file);
       const stat = fs.statSync(file);
       if (stat && stat.isDirectory()) { 
         results = results.concat(walk(file));
       } else { 
         if (file.endsWith('.ts')) results.push(file);
       }
     });
  } catch (e) {}
  return results;
}
const files = walk('src/services');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  if (content.includes('@/lib/db') || content.includes('../lib/db')) {
    content = content.replace(/import\s*\{\s*prisma\s*\}\s*from\s+['\"].*lib\/db['\"];?\r?\n?/g, 'import type { PrismaClient } from \'@prisma/client\';\n');
    content = content.replace(/\bprisma\./g, 'db.');
    fs.writeFileSync(file, content);
    console.log('Patched Service:', file);
  }
});
