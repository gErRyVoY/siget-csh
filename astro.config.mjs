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

  adapter: node({
      mode: 'standalone'
	}),

  integrations: [auth()]
});