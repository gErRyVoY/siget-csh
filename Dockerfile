# --- Etapa 1: Construcción (Builder) ---
# Usamos una imagen completa de Node para tener las herramientas de construcción.
FROM node:18 AS builder

# [FIX] Actualizar los paquetes del SO base para mitigar vulnerabilidades conocidas.
RUN apt-get update && apt-get upgrade -y

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
# Usamos una imagen limpia y ligera para la ejecución.
FROM node:18 AS runner

# [FIX] Actualizar los paquetes del SO base para mitigar vulnerabilidades conocidas.
RUN apt-get update && apt-get upgrade -y

# Instalar pnpm globalmente también aquí.
RUN npm install -g pnpm

WORKDIR /app

# Copiar los manifiestos de dependencias desde la etapa de construcción.
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# Instalar ÚNICAMENTE las dependencias de producción.
RUN pnpm install --prod --frozen-lockfile

# Copiar la carpeta 'dist' con la aplicación construida desde la etapa de construcción.
COPY --from=builder /app/dist ./dist



# Exponer el puerto que Astro usa por defecto en producción.
EXPOSE 4321

# El comando para iniciar el servidor de Node.js que sirve la aplicación.
CMD [ "node", "dist/server/entry.mjs", "--host", "0.0.0.0" ]