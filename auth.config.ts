import { defineConfig } from "auth-astro";
import Google from "@auth/core/providers/google";

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

      // Realizar la llamada a la API de Google para verificar la OU
      try {
        const response = await fetch(
          `https://admin.googleapis.com/admin/directory/v1/users/${profile.email}`,
          {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
            },
          }
        );

        if (response.ok) {
          const userData = await response.json();
          // Si existe la OU y no es la raíz, permitir el inicio de sesión
          if (userData.orgUnitPath && userData.orgUnitPath !== "/") {
            return true;
          }
        } else {
          // Registrar el error si la respuesta de la API no es exitosa
          console.error("Error en API de Google (signIn):", response.status);
        }
      } catch (error) {
        console.error("Error al obtener OU (signIn):", error);
        return '/login?error=ErrorInterno';
      }
      
      // Si la OU no se encontró o hubo un error, denegar el acceso
      return '/login?error=OUNoAsignada';
    },

    async jwt({ token, profile, account }) {
      // Añadir la OU al token si el usuario acaba de iniciar sesión
      if (profile && account?.access_token) {
        try {
          const response = await fetch(
            `https://admin.googleapis.com/admin/directory/v1/users/${profile.email}`,
            {
              headers: { Authorization: `Bearer ${account.access_token}` },
            }
          );

          if (response.ok) {
            const userData = await response.json();
            if (userData.orgUnitPath) {
              token.ou = userData.orgUnitPath;
            }
          }
        } catch (error) {
          console.error("Error al obtener OU (jwt):", error);
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

