// @ts-check
import { defineConfig, envField } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import auth from 'auth-astro';
import dotenv from 'dotenv';

// Cargar variables de entorno al inicio de todo
dotenv.config();

// https://astro.build/config
export default defineConfig({
  env: {
    schema: {
      AUTH_SECRET: envField.string({ context: "server", access: "secret" }),
      AUTH_GOOGLE_ID: envField.string({ context: "server", access: "secret" }),
      AUTH_GOOGLE_SECRET: envField.string({ context: "server", access: "secret" }),
      GOOGLE_SERVICE_ACCOUNT_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      GOOGLE_ADMIN_EMAIL: envField.string({ context: "server", access: "secret", optional: true })
    }
  },
  vite: {
      plugins: [tailwindcss()]
	},

  output: 'server',

  server: {
    host: '0.0.0.0'
  },

  adapter: cloudflare({
    platformProxy: {
      enabled: true
    }
  }),

  integrations: [auth()]
});