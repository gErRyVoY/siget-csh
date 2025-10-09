import { defineConfig } from "auth-astro";
import Google from "@auth/core/providers/google";
import { google } from "googleapis";
import { prisma } from "./src/lib/db";
import type { Rol, Empresa, Permiso } from "@prisma/client";
import type { DefaultSession } from "@auth/core/types";

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
    }),
  ],
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 horas en segundos
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (!profile?.email) {
        return '/login?error=NoProfile';
      }

      if (!profile.email.endsWith("@humanitas.edu.mx")) {
        return '/login?error=DominioNoPermitido';
      }

      if (!account?.access_token) {
        return '/login?error=NoToken';
      }

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

        if (!userData.orgUnitPath || userData.orgUnitPath === "/") {
            return '/login?error=OUNoAsignada';
        }

        if (!userData.orgUnitPath.toLowerCase().includes('colaboradores')) {
            return '/login?error=NoEsColaborador';
        }

        const dbUser = await prisma.usuario.findUnique({
            where: { mail: profile.email },
        });

        if (!dbUser) {
            const ouParts = userData.orgUnitPath.split('/').filter(part => part);
            const firstLevelOU = ouParts[0];

            if (!firstLevelOU) {
                console.error(`No se pudo extraer el primer nivel de la OU: ${userData.orgUnitPath}`);
                return '/login?error=ErrorOU';
            }

            const slug = firstLevelOU
                .toLowerCase()
                .replace(/^campus\s+/, '')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, '-');

            const empresa = await prisma.empresa.findUnique({
                where: { slug: slug },
            });

            if (!empresa) {
                console.error(`El slug '${slug}' derivado de la OU no corresponde a ninguna empresa en la BD.`);
                return '/login?error=EmpresaNoMapeada';
            }

            const defaultRoleId = 14;

            await prisma.usuario.create({
                data: {
                    mail: profile.email,
                    nombres: profile.given_name || 'Usuario',
                    apellidos: profile.family_name || 'Humanitas',
                    image: userData.thumbnailPhotoUrl,
                    empresaId: empresa.id,
                    rolId: defaultRoleId,
                    activo: true,
                    vacaciones: false,
                }
            });
            console.log(`Usuario ${profile.email} creado exitosamente.`);
        } else {
            await prisma.usuario.update({
                where: { mail: profile.email },
                data: {
                    nombres: profile.given_name ?? dbUser.nombres,
                    apellidos: profile.family_name ?? dbUser.apellidos,
                    image: userData.thumbnailPhotoUrl ?? dbUser.image,
                    ultimo_login: new Date(),
                }
            });
        }

        return true;

      } catch (error) {
        console.error("Error en el proceso de signIn:", error);
        return '/login?error=ErrorInterno';
      }
    },

    async jwt({ token }) {
      if (token.email) {
        const dbUser = await prisma.usuario.findUnique({
          where: { mail: token.email },
          include: {
            empresa: true,
            rol: {
              include: {
                permisos: true, // Incluir los permisos del rol
              },
            },
          },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.rol = dbUser.rol;
          token.empresa = dbUser.empresa;
          token.image = dbUser.image;
          // Guardar solo los nombres de los permisos en el token
          token.permisos = dbUser.rol.permisos.map(p => p.nombre);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = String(token.userId); // Convertir a string para cumplir el tipo
        session.user.rol = token.rol as Rol;
        session.user.empresa = token.empresa as Empresa;
        session.user.image = token.image as string | null;
        // Asignar los permisos a la sesión
        session.user.permisos = token.permisos as string[];
      }
      return session;
    },
  },
});

declare module "@auth/core/types" {
  interface Session {
    user: Omit<DefaultSession["user"], "id" | "image"> & {
      id?: string | number;
      rol?: Rol;
      empresa?: Empresa;
      image?: string | null;
      permisos?: string[]; // Añadir permisos a la sesión
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: number;
    rol?: Rol;
    empresa?: Empresa;
    image?: string | null;
    permisos?: string[]; // Añadir permisos al token
  }
}