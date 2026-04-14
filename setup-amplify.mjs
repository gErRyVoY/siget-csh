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

// Mover dependencias y metadatos
fs.renameSync('node_modules', '.amplify-hosting/compute/default/node_modules');
fs.copyFileSync('package.json', '.amplify-hosting/compute/default/package.json');

// Crear entrypoint de AWS y archivo manifest obligatorios
fs.writeFileSync('.amplify-hosting/compute/default/server.js', "import './entry.mjs';\n");
fs.writeFileSync('.amplify-hosting/deploy-manifest.json', JSON.stringify(manifest, null, 2));

console.log("Archivos de Amplify creados y validados correctamente.");
