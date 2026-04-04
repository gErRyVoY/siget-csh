// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
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

  server: {
    host: '0.0.0.0'
  },

  adapter: cloudflare(),

  integrations: [auth()]
});