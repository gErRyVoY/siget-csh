import { defineConfig } from "auth-astro";
import Google from "@auth/core/providers/google";
import { google } from "googleapis";

// Configuración simplificada para depuración.
// Se ha eliminado el callback `signIn` temporalmente.

export default defineConfig({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/admin.directory.user.readonly",
        },
      },
    }), // Auth.js usará las variables de entorno AUTH_GOOGLE_ID y AUTH_GOOGLE_SECRET
  ],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ account, profile }) {
      // Validar que el perfil y el email existan
      if (!profile?.email) {
        return '/login?error=NoProfile';
      }

      // Validar el dominio del correo
      if (!profile.email.endsWith("@humanitas.edu.mx")) {
        return '/login?error=DominioNoPermitido';
      }

      // Validar que la cuenta y el token de acceso existan
      if (!account?.access_token) {
        return '/login?error=NoToken';
      }

      // --- INICIO DE LA NUEVA LÓGICA DE AUTENTICACIÓN ---
      try {
        // 1. Cargar las credenciales de la cuenta de servicio desde la variable de entorno
        const serviceAccountCreds = JSON.parse(
          process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}"
        );

        // 2. Crear un cliente JWT autenticado, impersonando SIEMPRE a un administrador
        const auth = new google.auth.JWT({
          email: serviceAccountCreds.client_email,
          key: serviceAccountCreds.private_key,
          scopes: ["https://www.googleapis.com/auth/admin.directory.user.readonly"],
          subject: process.env.GOOGLE_ADMIN_EMAIL,
        });

        // 4. Crear una instancia del cliente de la API de Admin SDK
        const admin = google.admin({ version: "directory_v1", auth });

        // 5. Realizar la llamada a la API
        const response = await admin.users.get({
          userKey: profile.email,
        });

        const userData = response.data;

        // --- CÓDIGO DE DEPURACIÓN (OPCIONAL PERO RECOMENDADO) ---
        console.log(`[DEBUG] Datos de Google para ${profile.email}:`, JSON.stringify(userData, null, 2));

        // 6. Misma lógica de validación de OU
        if (userData.orgUnitPath && userData.orgUnitPath !== "/") {
          return true; // Permitir inicio de sesión
        }
        
        // Si la OU no es válida, denegar
        return '/login?error=OUNoAsignada';

      } catch (error) {
        console.error("Error al obtener OU con cuenta de servicio:", error);
        return '/login?error=ErrorInterno';
      }
      // --- FIN DE LA NUEVA LÓGICA DE AUTENTICACIÓN ---
    },

    async jwt({ token, profile }) {
      // Si el perfil existe (es decir, el usuario acaba de iniciar sesión),
      // intentamos obtener y adjuntar la OU al token.
      if (profile?.email) {
        try {
          const serviceAccountCreds = JSON.parse(
            process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}"
          );

          const auth = new google.auth.JWT({
            email: serviceAccountCreds.client_email,
            key: serviceAccountCreds.private_key,
            scopes: ["https://www.googleapis.com/auth/admin.directory.user.readonly"],
            subject: process.env.GOOGLE_ADMIN_EMAIL,
          });

          const admin = google.admin({ version: "directory_v1", auth });

          const response = await admin.users.get({
            userKey: profile.email,
          });

          const userData = response.data;
          if (userData.orgUnitPath) {
            token.ou = userData.orgUnitPath;
          }
        } catch (error) {
          console.error("Error al obtener OU para el token JWT:", error);
          token.ou = undefined; 
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Pasar la OU del token a la sesión del cliente
      if (session.user) {
        session.user.ou = token.ou as string;
      }
      return session;
    },
  },
});

// Necesitas extender los tipos de Auth.js para que TypeScript reconozca la nueva propiedad 'ou'.
declare module "@auth/core/types" {
  interface Session {
    user?: {
      ou?: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    ou?: string;
  }
}

