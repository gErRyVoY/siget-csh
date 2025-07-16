import { defineConfig } from "auth-astro";
import Google from "@auth/core/providers/google";

// Configuración simplificada para depuración.
// Se ha eliminado el callback `signIn` temporalmente.

export default defineConfig({
  providers: [
    Google, // Auth.js usará las variables de entorno AUTH_GOOGLE_ID y AUTH_GOOGLE_SECRET
  ],
  secret: import.meta.env.AUTH_SECRET,
  callbacks: {
    async signIn({ account, profile }) {
      // Aquí puedes añadir lógica para permitir o denegar el acceso
      // Por ahora, permitimos todos los inicios de sesión.
      return true;
    },
  },
});
