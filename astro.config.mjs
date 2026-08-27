// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import auth from 'auth-astro';
import dotenv from 'dotenv';

// Cargar variables de entorno al inicio de todo
dotenv.config();

// https://astro.build/config
export default defineConfig({
  vite: {
      plugins: [tailwindcss()]
	},

  output: 'server',

  // `<ClientRouter />` activa el prefetch con `prefetchAll: true` por su cuenta
  // (ClientRouter.astro llama a `init({ prefetchAll: true })`), así que hasta
  // ahora *cualquier* enlace que el usuario rozara disparaba un render SSR
  // completo con todas sus consultas. Se desactiva y se deja opt-in por enlace
  // con `data-astro-prefetch="hover"`, hoy sólo en los del Sidebar.
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },

  server: {
    host: '0.0.0.0'
  },

  adapter: node({
      mode: 'standalone'
	}),

  integrations: [auth()]
});