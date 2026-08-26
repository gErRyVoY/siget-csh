import { defineConfig } from "auth-astro";
import Google from "@auth/core/providers/google";
import { google } from "googleapis";
import { prisma } from "./src/lib/db";
import { getSessionUser, invalidateSessionUser } from "./src/lib/session-cache";
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
            "openid email profile https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/drive",
          access_type: "offline",
          response_type: "code"
        },
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
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

        const isTestUser = profile.email.toLowerCase() === 'alumno.prueba1@humanitas.edu.mx';
        let userData: any = {};
        let orgUnitPath = "";
        let orgUnit = "";

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

          userData = response.data || {};
          orgUnitPath = userData.orgUnitPath || "";
          orgUnit = orgUnitPath.toLowerCase();
        } catch (adminErr) {
          console.error("Error al consultar Google Admin Directory API:", adminErr);
          if (!isTestUser) {
            throw adminErr;
          }
        }

        if (!isTestUser) {
          if (!orgUnitPath || orgUnitPath === "/") {
            return '/login?error=OUNoAsignada';
          }

          const isColaborador = orgUnit.includes('colaboradores');
          const isEarlyAdopter = orgUnit.includes('early adopters');

          if (!isColaborador && !isEarlyAdopter) {
            return '/login?error=NoEsColaborador';
          }
        }

        const dbUser = await prisma.usuario.findUnique({
          where: { mail: profile.email },
        });

        // --- Consulta a API de Recursos Humanos ---
        let claveTrabajador: string | undefined = undefined;
        let puestoTrabajador: string | undefined = undefined;
        let horarioDisponibilidad: Record<string, { inicio: string; fin: string }> | undefined = undefined;

        if (!isTestUser) {
          try {
            // Usamos la URL base configurada o la de producción por defecto
            const baseUrl = process.env.API_RH_URL || 'https://pz3bmmqsty.us-east-1.awsapprunner.com';
            const rhResponse = await fetch(`${baseUrl}/api/rh/consultar-trabajador?email=${profile.email}`, {
              headers: {
                'accept': 'application/json',
                'x-api-key': process.env.TOKEN_ESPERADO || 'CHURRUMAIS-1979'
              }
            });

            if (!rhResponse.ok) {
              console.log(`API RH no devolvió respuesta exitosa para el correo: ${profile.email}`);
              return '/login?error=ColaboradorNoActivo';
            }

            const rhData = await rhResponse.json();
            if (rhData.status !== 'success' || !rhData.data?.trabajador) {
              console.log(`API RH no arrojó datos de trabajador activo para el correo: ${profile.email}`);
              return '/login?error=ColaboradorNoActivo';
            }

            claveTrabajador = rhData.data.trabajador;
            
            // Capturar el puesto del trabajador
            if (rhData.data?.desc_puesto) {
              puestoTrabajador = (rhData.data.desc_puesto as string).trim();
            }
            
            // Consultar horario con la clave obtenida
            const horarioResponse = await fetch(`${baseUrl}/api/rh/horario-trabajador?trabajador=${claveTrabajador}`, {
              headers: {
                'x-api-key': process.env.TOKEN_ESPERADO || 'CHURRUMAIS-1979'
              }
            });

            if (horarioResponse.ok) {
              const horarioResult = await horarioResponse.json();
              if (horarioResult.status === 'ok' && horarioResult.data && horarioResult.data.dias_laborales) {
                const apiDias = horarioResult.data.dias_laborales;
                const newHorario: Record<string, { inicio: string; fin: string }> = {};
                const diasMap: Record<string, string> = { "1": "lunes", "2": "martes", "3": "miercoles", "4": "jueves", "5": "viernes", "6": "sabado" };
                
                for (const num in diasMap) {
                  if (apiDias[num] && apiDias[num].turno_normal) {
                    const { entrada, salida } = apiDias[num].turno_normal;
                    const inicio = entrada.length === 4 ? `${entrada.substring(0, 2)}:${entrada.substring(2)}` : 'No disponible';
                    const fin = salida.length === 4 ? `${salida.substring(0, 2)}:${salida.substring(2)}` : 'No disponible';
                    if (inicio !== 'No disponible' && fin !== 'No disponible') {
                      newHorario[diasMap[num]] = { inicio, fin };
                    }
                  }
                }
                if (Object.keys(newHorario).length > 0) {
                  horarioDisponibilidad = newHorario;
                }
              }
            }
          } catch (error) {
            console.error("Error al consultar API de RH en el login:", error);
            // Si hay un error de red/servidor en la consulta del API de RH, bloqueamos por seguridad
            return '/login?error=ColaboradorNoActivo';
          }
        }

        if (!dbUser) {
          const orgUnit = userData.orgUnitPath || '';
          const ouParts = orgUnit.split('/').filter((part: string) => part);
          const firstLevelOU = ouParts[0];

          if (!firstLevelOU) {
            console.error(`No se pudo extraer el primer nivel de la OU: ${orgUnit}`);
            return '/login?error=ErrorOU';
          }

          const slug = firstLevelOU
            .toLowerCase()
            .replace(/^campus\s+/, '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-');

          const empresa = await prisma.empresa.findUnique({
            where: { slug: slug === 'corporativo-humanitas' ? 'corporativo' : slug },
          });

          if (!empresa) {
            console.error(`El slug '${slug}' derivado de la OU no corresponde a ninguna empresa en la BD.`);
            return '/login?error=AccesoNoPermitido';
          }

          const defaultRoleId = 1; // 'user' en el nuevo esquema

          await prisma.usuario.create({
            data: {
              mail: profile.email,
              nombres: profile.given_name || 'Usuario',
              apellidos: profile.family_name || 'Humanitas',
              image: userData.thumbnailPhotoUrl,
              empresaId: empresa.id,
              rolId: defaultRoleId,
              activo: true,
              acepta_tickets: true,
              ...(claveTrabajador && { clave: claveTrabajador }),
              ...(puestoTrabajador && { puesto: puestoTrabajador }),
              ...(horarioDisponibilidad && { horario_disponibilidad: horarioDisponibilidad }),
            }
          });
          console.log(`Usuario ${profile.email} creado exitosamente.`);
        } else {
          // Si el usuario ya existe en la base de datos de SiGeT y se encuentra inactivo, denegar inicio de sesión
          if (!dbUser.activo) {
            console.warn(`Intento de inicio de sesión bloqueado para usuario inactivo: ${profile.email}`);
            return '/login?error=UsuarioInactivo';
          }

          // Cotejar si el puesto cambió y actualizar si difiere
          const needsPuestoUpdate = puestoTrabajador && puestoTrabajador !== dbUser.puesto;

          await prisma.usuario.update({
            where: { mail: profile.email },
            data: {
              nombres: profile.given_name ?? dbUser.nombres,
              apellidos: profile.family_name ?? dbUser.apellidos,
              image: userData.thumbnailPhotoUrl ?? dbUser.image,
              ultimo_login: new Date(),
              ...(!dbUser.clave && claveTrabajador && { clave: claveTrabajador }),
              ...(needsPuestoUpdate && { puesto: puestoTrabajador }),
              ...(horarioDisponibilidad && { horario_disponibilidad: horarioDisponibilidad }),
            }
          });
        }

        // El signIn acaba de crear o actualizar la fila del usuario; cualquier
        // entrada previa del caché quedó obsoleta.
        invalidateSessionUser(profile.email);

        return true;

      } catch (error) {
        console.error("Error en el proceso de signIn:", error);
        return '/login?error=ErrorInterno';
      }
    },

    async jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token;
      }

      if (token.email) {
        // Datos, permisos y secciones del usuario, con micro-caché de 15 s por correo
        // (src/lib/session-cache.ts). Sin él esta consulta cuesta 6-8 sentencias en
        // cada petición, porque Prisma resuelve cada relación del `include` aparte.
        //
        // Los cambios desde /admin/secciones y /admin/roles siguen viéndose con un F5:
        // esos endpoints invalidan la entrada del caché. `session_version` no se cachea
        // nunca, así que la revocación de sesiones sigue siendo inmediata.
        const fullUser = await getSessionUser(token.email);

        if (fullUser) {
          // --- Validación de versión de sesión ---
          // Si la session_version del token no coincide con la de la BD, un admin invalidó
          // esta sesión (cambio de rol o desactivación). Se devuelve null para destruir la cookie.
          const dbVersion = (fullUser as any).session_version ?? 1;
          if (token.sessionVersion !== undefined && token.sessionVersion !== dbVersion) {
            return null; // Auth.js destruye la cookie automáticamente al recibir null
          }
          // Guardar la versión actual en el token para comparaciones futuras
          token.sessionVersion = dbVersion;

          token.userId = fullUser.id;
          token.image = fullUser.image;
          token.alias = fullUser.alias ?? undefined;
          token.acepta_tickets = fullUser.acepta_tickets;
          token.puesto = (fullUser as any).puesto ?? undefined;
          token.tckt_csh = (fullUser as any).tckt_csh ?? true;
          token.tckt_mkt = (fullUser as any).tckt_mkt ?? false;
          token.atiende_csh = (fullUser as any).atiende_csh ?? false;
          token.atiende_mkt = (fullUser as any).atiende_mkt ?? false;
          
          token.rolId = fullUser.rolId;
          token.rol = fullUser.rol;
          token.empresa = fullUser.empresa;
          
          token.permisos = fullUser.rol.permisos.map(p => p.nombre);

          // Calcular secciones base del rol
          const seccionesRolList = fullUser.rol.permisos_seccion
            .filter(ps => ps.activo && ps.seccion.activo)
            .map(ps => ps.seccion.identificador);
          
          let seccionesAprobadas = new Set(seccionesRolList);

          // Aplicar overrides individuales del usuario
          fullUser.permisos_seccion.forEach(ps => {
            if (!ps.seccion.activo) return;
            
            if (ps.activo) {
              seccionesAprobadas.add(ps.seccion.identificador);
            } else {
              seccionesAprobadas.delete(ps.seccion.identificador);
            }
          });

          token.secciones = Array.from(seccionesAprobadas);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = String(token.userId);
        session.user.rol = token.rol as Rol;
        session.user.empresa = token.empresa as Empresa;
        session.user.image = token.image as string | null;
        session.user.alias = token.alias as string | undefined;
        session.user.acepta_tickets = (token.acepta_tickets as boolean | undefined) ?? true;
        session.user.puesto = token.puesto as string | undefined;
        // Propagate tckt and atiende flags from user (stored in token)
        (session.user as any).tckt_csh = (token as any).tckt_csh ?? true;
        (session.user as any).tckt_mkt = (token as any).tckt_mkt ?? false;
        (session.user as any).atiende_csh = (token as any).atiende_csh ?? false;
        (session.user as any).atiende_mkt = (token as any).atiende_mkt ?? false;
        // Asignar los permisos a la sesión
        session.user.permisos = token.permisos as string[];
        session.user.secciones = token.secciones as string[];
        // Asignar access token
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
});

declare module "@auth/core/types" {
  interface Session {
    accessToken?: string;
    user: Omit<DefaultSession["user"], "id" | "image" | "name" | "email"> & {
      id?: string | number;
      name?: string | null;
      email?: string | null;
      rol?: Rol;
      empresa?: Empresa;
      image?: string | null;
      alias?: string;
      puesto?: string;
      acepta_tickets?: boolean;
      tckt_csh?: boolean;
      tckt_mkt?: boolean;
      atiende_csh?: boolean;
      atiende_mkt?: boolean;
      permisos?: string[];
      secciones?: string[];
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    userId?: number;
    sessionVersion?: number;
    rol?: Rol;
    empresa?: Empresa;
    image?: string | null;
    alias?: string;
    puesto?: string;
    acepta_tickets?: boolean;
    atiende_csh?: boolean;
    atiende_mkt?: boolean;
    permisos?: string[];
    secciones?: string[];
  }
}