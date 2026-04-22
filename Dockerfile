# --- Etapa 1: Construcción (Builder) ---
# Usamos una imagen completa de Node para tener las herramientas de construcción.
FROM node:20-slim AS builder

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
FROM node:20-slim AS runner

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

# Generar el cliente de Prisma para producción
RUN npx prisma generate

# Copiar la carpeta 'dist' con la aplicación construida desde la etapa de construcción.
COPY --from=builder /app/dist ./dist

# Variables de entorno exigidas por Astro Node Adapter en Standalone mode.
ENV HOST=0.0.0.0
ENV PORT=4321

# Exponer el puerto que Astro usa por defecto en producción.
EXPOSE 4321

# Iniciar el servidor exportado por el build.
CMD [ "node", "./dist/server/entry.mjs" ]