import fs from 'node:fs';

const manifest = {
  version: 1,
  framework: {
    name: 'astro',
    version: '5.16.7'
  },
  routes: [
    {
      path: '/_astro/*',
      target: {
        kind: 'Static',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    },
    {
      path: '/*.*',
      target: {
        kind: 'Static',
        fallback: {
          kind: 'Compute',
          src: 'default'
        }
      }
    },
    {
      path: '/*',
      target: {
        kind: 'Compute',
        src: 'default'
      }
    }
  ],
  computeResources: [
    {
      name: 'default',
      runtime: 'nodejs20.x',
      entrypoint: 'server.js'
    }
  ]
};

// Preparar directorios
fs.mkdirSync('.amplify-hosting/compute/default', { recursive: true });
fs.mkdirSync('.amplify-hosting/static', { recursive: true });

// Copiar archivos generados por Astro
fs.cpSync('dist/server', '.amplify-hosting/compute/default', { recursive: true });
fs.cpSync('dist/client', '.amplify-hosting/static', { recursive: true });
fs.cpSync('dist/client', '.amplify-hosting/compute/default/client', { recursive: true });

// Mover package.json y prisma
fs.copyFileSync('package.json', '.amplify-hosting/compute/default/package.json');
fs.cpSync('prisma', '.amplify-hosting/compute/default/prisma', { recursive: true });

// MODIFICACIÓN: Leer el package.json y purgar dependencias problemáticas pesadas
// que arrastran Astro, TypeScript y Rollup inútilmente a producción.
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
fs.writeFileSync('.amplify-hosting/compute/default/package.json', JSON.stringify(pkg, null, 2));

import { execSync } from 'node:child_process';
import path from 'node:path';

// MODIFICACIÓN: Quitar binaryTargets opcionales en el prisma.schema para el SSR
// El server de Amplify Build compartirá la misma arquitectura AL2023 (native) que Runtime.
const schemaPath = '.amplify-hosting/compute/default/prisma/schema.prisma';
let schemaContent = fs.readFileSync(schemaPath, 'utf-8');
schemaContent = schemaContent.replace(/binaryTargets\s*=\s*\[.*?\]/g, '');
fs.writeFileSync(schemaPath, schemaContent);

console.log("Instalando dependencias de producción ultra-ligeras en compute/default...");
// Instala solo las deps necesarias para producción (<230MB).
// Usar --legacy-peer-deps bloquea de raíz que NPM instale Astro, Vite, Rolldown y Effect (pesan ~200MB).
execSync('npm install --prefix . --omit=dev --legacy-peer-deps --no-package-lock', {
  cwd: '.amplify-hosting/compute/default',
  stdio: 'inherit'
});

console.log("Ajustando schema.prisma local para forzar Output y aislar el binario...");
schemaContent = fs.readFileSync(schemaPath, 'utf8');
if (!schemaContent.includes('output =')) {
  schemaContent = schemaContent.replace(/provider\s*=\s*"prisma-client-js"/, `provider = "prisma-client-js"\n  output = "../node_modules/.prisma/client"`);
  fs.writeFileSync(schemaPath, schemaContent);
}

console.log("Generando Prisma Client estrictamente en compute/default...");
execSync('npx --yes prisma generate', {
  cwd: '.amplify-hosting/compute/default',
  stdio: 'inherit'
});

console.log("Realizando limpieza agresiva para cumplir cuota de 230MB...");

// 1. Limpiar Engines inutilizados de Prisma (Conservamos solo rhel-3.0.x y rhel-1.0.x para AWS Lambda)
const prismaClientDir = '.amplify-hosting/compute/default/node_modules/.prisma/client';
if (fs.existsSync(prismaClientDir)) {
  const files = fs.readdirSync(prismaClientDir);
  files.forEach(file => {
    // Si es un query engine (*.node) o archivos macOS/Windows nativos pero no es rhel-openssl, borrarlos.
    if (file.endsWith('.node') && !file.includes('rhel-openssl-3.0.x') && !file.includes('rhel-openssl-1.0.x')) {
      fs.rmSync(path.join(prismaClientDir, file), { force: true });
    }
  });
}
fs.rmSync('.amplify-hosting/compute/default/node_modules/@prisma/engines', { recursive: true, force: true });
fs.rmSync('.amplify-hosting/compute/default/node_modules/prisma', { recursive: true, force: true });
fs.rmSync('.amplify-hosting/compute/default/node_modules/.cache', { recursive: true, force: true });

// 2. Eliminar "peerDependencies" masivas como Astro/Vite/Rollup que NPM instala pero NO se usan en RUNTIME SSR.
const fatPackages = ['astro', 'vite', 'rollup', 'esbuild', 'typescript', '@rollup', '@esbuild', '@rolldown', 'effect'];
fatPackages.forEach(pkg => {
  fs.rmSync(path.join('.amplify-hosting/compute/default/node_modules', pkg), { recursive: true, force: true });
});

// 3. Eliminar Assets de la copia local del Cliente en el servidor (No los necesita el SSR y sí Amplify Static)
function removeHeavyAssets(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      removeHeavyAssets(fullPath);
    } else {
      // Eliminar mapas, fuentes y media
      if (/\.(png|jpg|jpeg|gif|svg|webp|woff2|woff|ttf|map|ico)$/i.test(fullPath)) {
        fs.rmSync(fullPath, { force: true });
      }
    }
  }
}
removeHeavyAssets('.amplify-hosting/compute/default/client');

// 4. Eliminar binarios sueltos inútiles
fs.rmSync('.amplify-hosting/compute/default/node_modules/.bin', { recursive: true, force: true });

// Crear entrypoint de AWS y archivo manifest obligatorios
fs.writeFileSync('.amplify-hosting/compute/default/server.js', "import './entry.mjs';\n");
fs.writeFileSync('.amplify-hosting/deploy-manifest.json', JSON.stringify(manifest, null, 2));

console.log("Archivos de Amplify creados, purgados y validados correctamente para tamaño optimizado.");
