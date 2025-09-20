// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import auth from 'auth-astro';
import react from '@astrojs/react';
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

  adapter: node({
      mode: 'middleware'
	}),

  integrations: [auth(), react()]
});