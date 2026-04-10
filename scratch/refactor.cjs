const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.astro') || file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('src/pages');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  if (content.includes('@/lib/db') || content.includes('../lib/db')) {
    
    // Eliminar el import
    content = content.replace(/import\s*\{\s*prisma\s*\}\s*from\s+['\"].*lib\/db['\"];?\r?\n?/g, '');
    
    if (file.endsWith('.astro')) {
        // En Astro se inyecta desde Astro.locals debajo del triple guión inicial
        content = content.replace(/^---\r?\n/, '---\nconst { db } = Astro.locals;\n');
        fs.writeFileSync(file, content);
        console.log('Patched Astro:', file);
    } else if (file.endsWith('.ts')) {
        // En TS (Endpoints), debemos agarrar `export const GET/POST = async (context)`
        // Muchisimos endpoints son async ({ request }) => ...
        // Simplificaremos insertando al inicio de cualquier export const METHOD = async ...
        let lines = content.split('\n');
        let inEndpoint = false;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.match(/export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*:\s*APIRoute\s*=\s*async\s*\(([^)]+)\)\s*=>\s*\{/)) {
                // Check what the arg is
                let match = line.match(/export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*:\s*APIRoute\s*=\s*async\s*\(([^)]+)\)\s*=>\s*\{/);
                let arg = match[2].trim();
                if (arg === 'context') {
                    // Nothing to change in signature
                    lines.splice(i+1, 0, '  const { db } = context.locals;');
                } else if (arg.startsWith('{')) {
                    // Destructured object: ({ request, url })
                    // Nos aseguramos q tenga locals
                    if (!arg.includes('locals')) {
                        let newArg = arg.replace(/\{/, '{ locals, ');
                        lines[i] = line.replace(arg, newArg);
                    }
                    lines.splice(i+1, 0, '  const { db } = locals;');
                }
                i++; // Skip the added line
            }
        }
        content = lines.join('\n');
        fs.writeFileSync(file, content);
        console.log('Patched TS:', file);
    }
  }
});
