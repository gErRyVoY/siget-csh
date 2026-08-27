# --- Etapa 1: Construcción (Builder) ---
# Usamos una imagen completa de Node para tener las herramientas de construcción.
FROM node:22-slim AS builder

# [FIX] Actualizar los paquetes del SO base para mitigar vulnerabilidades y asegurar dependencias de Prisma
RUN apt-get update && apt-get upgrade -y && apt-get install -y openssl

# Instalar pnpm globalmente en la imagen.
RUN npm install -g pnpm

# Establecer el directorio de trabajo.
WORKDIR /app

# Copiar solo los archivos de manifiesto de dependencias.
COPY package.json pnpm-lock.yaml ./

# Instalar TODAS las dependencias (incluyendo las de desarrollo) de forma optimizada.
RUN pnpm install --frozen-lockfile

# Copiar el resto del código fuente (respetando .dockerignore).
COPY . .

# Ejecutar el script de construcción para generar la carpeta /dist.
RUN pnpm run build


# --- Etapa 2: Producción (Runner) ---
# Usamos el mismo SO base ligero que el builder para evitar incompatibilidades de binarios en Prisma.
FROM node:22-slim AS runner

RUN apt-get update && apt-get upgrade -y && apt-get install -y openssl

# Instalar pnpm globalmente también aquí.
RUN npm install -g pnpm

WORKDIR /app

# Copiar los manifiestos de dependencias desde la etapa de construcción.
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# Copiar la carpeta prisma para tener el schema.prisma
COPY --from=builder /app/prisma ./prisma

# Instalar ÚNICAMENTE las dependencias de producción.
RUN pnpm install --prod --frozen-lockfile

# Generar el cliente de Prisma con la CLI que ya instaló pnpm (prisma es dependencia
# de producción). Antes esto era `npx prisma@6.19.1 generate`, que descargaba el
# paquete de la red en cada build y podía desalinearse de @prisma/client.
RUN pnpm exec prisma generate

# Copiar la carpeta 'dist' con la aplicación construida desde la etapa de construcción.
COPY --from=builder /app/dist ./dist

# Variables de entorno exigidas por Astro Node Adapter en Standalone mode.
ENV HOST=0.0.0.0
ENV PORT=4321

# Sin esto, src/lib/db.ts no puede distinguir producción y seguiría registrando
# cada sentencia SQL en CloudWatch.
ENV NODE_ENV=production

# Exponer el puerto que Astro usa por defecto en producción.
EXPOSE 4321

# El proceso no escribe en disco (los adjuntos van a S3), así que no necesita root.
# `node` es el usuario sin privilegios que ya trae la imagen oficial (uid 1000).
USER node

# App Runner usa su propia comprobación de salud; esto sirve para docker-compose y
# para `docker ps` en local. Se usa fetch de Node en lugar de curl/wget porque la
# imagen slim no los incluye.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3     CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Iniciar el servidor exportado por el build.
CMD [ "node", "./dist/server/entry.mjs" ]