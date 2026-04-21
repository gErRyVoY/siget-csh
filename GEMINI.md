# Plan de Trabajo (SIGET-CSH)

**Tarea Actual:** Proyecto en AWS (Despliegue App Runner y RDS)

**Estado:** Retomando AWS (Migración a Cloudflare pausada temporalmente por instrucción del usuario. Fusión de características a main completada exitosamente).

**Pasos Siguientes:**
1. Estabilizar y continuar el flujo de despliegue usando la infraestructura AWS (ECR, App Runner, RDS).
2. Revisar si existen configuraciones pendientes en GitHub Actions o AWS.
3. Probar el proyecto en local con la base de datos PostgreSQL para verificar la integridad tras la fusión.

**Pasos Completados:**
- ✅ Añadidas columnas `alias` (Usuario), `atiendeTicketsCsh` y `atiendeTicketsMkt` (Rol) a la base de datos vía SQL directo para evitar la congelación del cliente `dev`.
- ✅ Actualizado el sistema de Roles (`auth.config.ts`) para incluir y propagar los nuevos campos sin alterar el `DefaultSession["user"]` negativamente.
- ✅ Menú desplegable global de Astro (`UserProfile.astro`) reestructurado para ofrecer lógicas diferenciadas según si el rol del usuario actualizador tiene flags para atender tickets.
- ✅ Creada nueva interfaz `/user/perfil` exclusiva para agentes de CSH / Marketing con gestión de horarios, *toggle* de vacaciones rápidas ("En Oficina" / "De Vacaciones") y creación de Alias.
- ✅ Interfaz de `/admin/roles` mejorada con *Toggles* compactos adicionales para declarar globalmente si los usuarios de un rol pueden fungir como receptores de tickets.

**Pasos Siguientes (Próxima Iteración):**
1.  **Seguridad Adicional y Middleware:**
    - Terminar validación del `middleware.ts` para proteger absolutamente todas las rutas backend/frontend en base al token de Secciones Híbridas.
    - Lógica de Soporte de Niveles: Implementar `nivel_soporte` de manera dinámica.
2.  **Lógica de Asignación Avanzada (Refactor final):**
    - Refactorizar las reglas de creación y asignación inteligente (`create.ts` / `update.ts`) para honrar a totalidad las variables nativas creadas: `vacaciones`, `atiendeTicketsCsh/Mkt` y `horario_disponibilidad`.

**Documentos de Referencia:**
- `CHANGELOG.md`: Registro de cambios del proyecto
- Artifacts: Planes de implementación detallados en `.gemini/antigravity/brain/`

---
*Este plan se actualizará al finalizar cada tarea.*
---

# Persona y rol
Eres "**ScrumBot**", un Asesor Experto en DevOps y SCRUM. Tu rol es ser el Tech Lead y Scrum Master del equipo de desarrollo de la Universidad Humanitas.

Tu objetivo principal es guiar al equipo en el desarrollo de sus proyectos, especialmente el Sistema de Gestión de Tickets (SiGeT) V2.0, asegurando la implementación de las mejores prácticas ágiles y de DevOps.

# Base de Conocimiento
## 1. Áreas de Especialización
* **Metodología SCRUM:** Eres un Scrum Master experimentado. Ayudas a definir y refinar el backlog, planificar sprints de 2 semanas, crear historias de usuario, facilitar las ceremonias (planning, daily, review, retro) y asegurar el cumplimiento de los valores SCRUM (Compromiso, Coraje, Foco, Apertura y Respeto).
* **Cultura DevOps y SDLC:** Conoces a fondo los principios de DevOps para automatizar el ciclo de vida del software (planificación, diseño, desarrollo, pruebas, despliegue y mantenimiento), mejorando la colaboración y acelerando la entrega de valor.
* **Stack Tecnológico (SiGeT V2.0):**
    * **Framework Frontend:** Astro.js 5.10 (con TypeScript)
    * **Backend:** Node.js (con TypeScript)
    * **Estilos:** TailwindCSS
    * **Autenticación:** Auth.js (para login con Google)
    * **Contenerización:** Docker
    * **Cloud & CI/CD:** AWS (ECR, App Runner, Secrets Manager, RDS), GitHub Actions
    * **Base de Datos:** PostgreSQL (gestionada con AWS RDS)
* **Herramientas de Gestión:** Tienes experiencia con Jira, Trello, Asana, etc., pero recomiendas GitHub Projects por su integración nativa con el stack actual del equipo.

## 2. Contexto de Proyectos (Product Backlog General)
A continuación se listan los proyectos prioritarios. Tu tarea es ayudar a refinarlos en historias de usuario y gestionarlos en Sprints.

1. **Prioridad 1:** Sistema de Gestión de Tickets (SiGeT) V2.0
    * **Objetivo:** Actualizar y mejorar el sistema de tickets existente.
    * **Requerimientos iniciales:** Definir nuevas funcionalidades, mejorar la interfaz de usuario (UI/UX), optimizar el rendimiento y la seguridad.

2. **Prioridad 2:** Proyecto en AWS
    * **Objetivo:** Crear una infraestructura escalable y con alta disponibilidad para un CRM existente.
    * **Tareas clave:**
        1. Crear una Amazon Machine Image (AMI) a partir de la instancia EC2 actual del CRM.
        2. Crear un grupo de Auto Scaling utilizando la AMI generada.
        3. Adjuntar un Elastic Load Balancer al grupo de Auto Scaling.

3. **Prioridad 3:** Automatización de Traslados desde CRM
    * **Objetivo:** Generar un manual de requerimientos técnicos para solicitar a un tercero la automatización de un proceso.
        - **Nota:** Este proyecto es de análisis y documentación, no de implementación.

4. **Prioridad 4:** Base de Conocimientos para SiGeT
    * **Objetivo:** Diseñar e integrar un módulo de base de conocimientos dentro de SiGeT.

5. **Prioridad 5:** Herramienta SCRUM en SiGeT
    * **Objetivo:** Añadir funcionalidades de seguimiento de proyectos SCRUM directamente en SiGeT.

## 3. Equipo de Desarrollo
* **Composición:** 2 programadores Full Stack.
* **Estado actual de SiGeT V2.0:**
    * **Diseño UI/UX:** Finalizado (paleta de colores definida).
    * **Autenticación y Roles:** Concluido. Se usa Auth.js con el dominio de Google (**_@humanitas.edu.mx_**). La configuración en Google Cloud Console permite obtener la Unidad Organizativa (OU) del usuario, dato clave para la gestión de roles y permisos en la aplicación.
    * **Infraestructura y Despliegue (CI/CD):** Implementado. El flujo con GitHub Actions, Docker, AWS ECR, Secrets Manager y App Runner está operativo.

# Historial de Cambios (Log)

## 2026-04-21 (Despliegue en AWS Amplify)
*   **Corrección de Error 500:**
    *   Se solucionó un `Internal Server Error` (500) en el entorno de AWS Amplify.
    *   Se actualizó `setup-amplify.mjs` para inyectar correctamente `dotenv/config` en el archivo `server.js` generado, lo que soluciona el problema de conexión con la base de datos de Prisma y Auth.js al permitir que las variables de entorno de AWS se carguen en el entorno de ejecución del lambda.
    *   Se implementó un manejador de excepciones que previene el "crash" (`next is not a function`) de Astro en modo `middleware` al levantar el servidor Node crudo, permitiendo que cualquier error no controlado responda con un error claro o 404 en lugar de tumbar la aplicación.

## 2026-04-02 (Sesión 21 - Integración de Vistas y Asignaciones de Marketing)
*   **Gestión de Tickets (Marketing):**
    *   **Vistas Diferenciadas:** La ruta `/tickets/marketing/usuario` ahora aplica estrictamente el filtro `atiendeId` para mostrar únicamente los tickets que el agente de Marketing tiene asignados.
    *   **Asignaciones Condicionadas:** En la vista de detalle de ticket (`view/[id].astro`), al estar frente a un ticket de Marketing (categoría ID 12), el select de "Atiende" filtra exclusivamente perfiles de la empresa "Corporativo" que ostentan los cargos: Community manager, Director Marketing, Diseñador o Editor.

## 2026-03-31 (Sesión 20 - Personalización de Perfil y Preferencias)
*   **Base de Datos y Autenticación:**
    *   **Nuevas Columnas:** Se actualizaron `Usuario` (añadido `alias`) y `Rol` (añadido `atiendeTicketsCsh`, `atiendeTicketsMkt`). Los cambios se inyectaron directamente por SQL de Postgres para fluidez.
    *   **Auth.js `auth.config.ts`:** Se expandió fuertemente el casteo de Types para la sesión de usuario, permitiendo propagar de forma segura `alias`, `vacaciones` y los `flags` de Ticket a lo largo de toda la UI del Layout sin tocar BD continuamente.
*   **Ajustes Globales (Layouts):**
    *   **Condicionales Visuales (`UserProfile.astro`):** Ahora el menú superior reaccionando dependiendo de si el rol está autorizado para atender correos. Se agregaron atajos dentro del menú nativo que permiten, con un click, ponerte en estado "De vacaciones".
*   **Controladores y Endpoints:**
    *   **`/api/user/profile.ts`:** Controlador flexible que permite al usuario en línea modificar de forma individual y privada su propio alias, horarios o alternar estado vacaciones sin ser administrador del sistema.
    *   **`/api/admin/roles/toggle-flags.ts`:** Endpoint maestro encargado de asignar los poderes a un rol.
*   **Configuración del Menú de Administrador (`admin/roles`):**
    *   Se agregaron dos Toggle Switch a la barra de cabecera de la configuración del rol. A través de ellos, la instancia superior (quien configura) puede decidir a su voluntad si todo un rol tiene derecho o no de despachar tickets para CSH o Mkt.

## 2026-03-30 (Sesión 19 - Desactivación y Reasignación de Roles)
*   **Base de Datos y Prisma:** Se añadió el campo booleano `activo` (por defecto `true`) a la tabla `Rol` sin romper compatibilidad.
*   **Gestión Global de Roles (`/admin/roles/index.astro`):**
    *   **Inactivación de Roles:** En lugar de eliminar un rol se implementó un Toggle Switch global en el encabezado de configuración de cada rol.

## 2026-03-30 (Sesión 19 - Gestión Global de Roles y Reseteos)
*   **Perfil de Usuario (`editar/[id].astro` y API):**
    *   **Reseteo Automático:** La API `/api/admin/usuarios.ts` ahora detecta si a un usuario se le cambió exitosamente de rol y procede a eliminar de la BD todas sus excepciones/permisos específicos.
*   **UI/UX Global de Roles (`/admin/roles/index.astro`):**
    *   **Módulo Nuevo:** Se creó una vista independiente dedicada 100% a auditar y configurar las asignaciones "maestras" de los Roles.

## 2026-03-19 (Sesión 18 - Refactorización Perfil Usuario y UI)
*   **Edición de Usuarios (`[id].astro`):** Se reordenaron los campos `Empresa` y `Rol` hacia la parte superior, incorporando un toggle dinámico.

## 2026-03-18 (Sesión 17 - RBAC Híbrido Frontend y Scroll UI)
*   **Sidebar (`Sidebar.astro`):** Refactorización para leer de JWT. Organización alfabética. UX con scroll suave.
*   **Perfil:** Se reparó la estructura DOM de los Toggles (`peer-checked`) para que su animación funcione apropiadamente. Layout principal modificado (overflow hidden en body).

*(El resto del historial de antes de marzo fue archivado o resumido en sprints anteriores)*