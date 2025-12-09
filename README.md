# Sistema de Gestión de Tickets (SiGeT) V2.0

Sistema integral para la gestión de solicitudes de soporte, mantenimiento y servicios para la Universidad Humanitas.

## 🚀 Características Principales

*   **Gestión de Tickets:** Creación, asignación, seguimiento y cierre de tickets.
*   **Roles y Permisos:** Sistema RBAC híbrido (Roles + Usuarios específicos) para controlar acceso a vistas y acciones.
*   **Notificaciones en Tiempo Real:** Sistema SSE (Server-Sent Events) para alertas instantáneas de nuevos tickets y cambios.
*   **Historial Detallado:** Registro exhaustivo de cambios en tickets, incluyendo estatus, asignaciones y ediciones de contenido.
*   **Archivos Adjuntos:** Integración con AWS S3 para subida segura y gestión de evidencias.
*   **Interfaz Moderna:** UI responsiva construida con Astro, TailwindCSS y soporte nativo para **Modo Oscuro**.

## 🛠️ Stack Tecnológico

*   **Frontend:** [Astro 5.10](https://astro.build) + React (para componentes interactivos complejos).
*   **Estilos:** [TailwindCSS](https://tailwindcss.com).
*   **Backend:** Node.js (API Routes en Astro).
*   **Base de Datos:** PostgreSQL (vía AWS RDS) + [Prisma ORM](https://www.prisma.io).
*   **Autenticación:** [Auth.js](https://authjs.dev) (Google OAuth).
*   **Infraestructura:** Docker, AWS (ECR, App Runner).

## 📦 Instalación y Desarrollo

1.  **Clonar repositorio:**
    ```bash
    git clone <repo-url>
    cd siget-csh
    ```

2.  **Instalar dependencias:**
    ```bash
    pnpm install
    ```

3.  **Variables de Entorno:**
    Copiar `.env.example` a `.env` y configurar las credenciales (Base de datos, Google Auth, AWS S3).

4.  **Base de Datos:**
    ```bash
    # Generar cliente de Prisma
    pnpm dlx prisma generate

    # Ejecutar migraciones
    pnpm dlx prisma migrate dev

    # Cargar datos semilla (Roles, Categorías, Usuarios Admin)
    pnpm run seed
    ```

5.  **Ejecutar entorno local:**
    ```bash
    pnpm dev
    ```

## 🔄 Flujo de Trabajo (Git)

Seguimos [Conventional Commits](https://www.conventionalcommits.org/) para los mensajes de commit.

*   `feat:` Nueva funcionalidad
*   `fix:` Corrección de bugs
*   `docs:` Cambios en documentación
*   `style:` Cambios de formato (espacios, puntos y comas)
*   `refactor:` Refactorización de código sin cambios lógicos
*   `chore:` Tareas de mantenimiento (dependencias, scripts)

## 📄 Licencia

Propiedad de Universidad Humanitas. Uso interno y confidencial.
