# HEM2026 — Hackathon EduTech Mendoza 2026

![Estado](https://img.shields.io/badge/Estado-Release_v1.0_QA_Ready-success)

Plataforma web oficial para la **Hackathon EduTech Mendoza 2026**, desarrollada de manera colaborativa por estudiantes del **IES 9-023** y el **IES Tomás Alva Edison**.

## ¿Por qué HEM2026?

El nombre del repositorio utiliza un acrónimo práctico y fácil de recordar:

| Letra | Significado |
|-------|-------------|
| **H** | Hackathon |
| **E** | EduTech |
| **M** | Mendoza |
| **2026** | Año de realización |

> El nombre puede cambiar en cualquier momento si el equipo lo decide, pero estas siglas servirán como identificador interno del proyecto.

---

## Tecnologías

### Desarrollo

| Tecnología | Rol | Descripción |
|------------|-----|-------------|
| [Astro](https://astro.build/) | Frontend | Framework web moderno con enfoque en rendimiento. Genera sitios estáticos (SSG) con hidratación parcial, ideal para una plataforma informativa con secciones interactivas. |
| [Supabase](https://supabase.com/) | Backend | Backend-as-a-Service basado en PostgreSQL. Proporciona autenticación, base de datos con Row Level Security (RLS), almacenamiento y Edge Functions. |
| TypeScript | Lenguaje | Se utiliza cuando es necesario para tipado estático y mayor robustez en la integración con Supabase. |
| Git / GitHub | Control de versiones | Gestión colaborativa del código fuente con ramas protegidas y revisiones de código. |

### Despliegue e Infraestructura

| Servicio | Función | Configuración |
|----------|---------|---------------|
| [Vercel](https://vercel.com/) | Hosting del frontend | Deploys automáticos conectados a GitHub. `main` → Producción, `develop` → Preview/Staging. |
| [Supabase](https://supabase.com/) | Backend en la nube | Base de datos PostgreSQL, autenticación, RLS, encriptación y Edge Functions para lógica serverless. |
| [Sentry](https://sentry.io/) | Monitoreo y observabilidad | Captura de errores en tiempo real, logs, métricas de performance y protección contra anomalías. |
| Vercel Analytics | Métricas de uso | Análisis de tráfico, Web Vitals y comportamiento de usuarios en producción. |
| [Nic.ar](https://nic.ar/) | Dominio | Dominio `.com.ar` (pendiente aprobación institucional, ~$8500 ARS). |

---

## Flujo de Trabajo con Git

El proyecto utiliza un flujo de ramas protegidas para garantizar la estabilidad de producción:

```
┌─────────────────┐    PR + Test OK    ┌──────────┐    PR + Test OK    ┌──────────────┐
│ [Nombre]_Develop │ ─────────────────► │ develop  │ ─────────────────► │ main (Prod)  │
└─────────────────┘                    └──────────┘                    └──────────────┘
      Tu rama                           Staging                        Producción
```

1. Cada desarrollador trabaja en su propia rama: `[Nombre]_Develop`
2. Cuando el trabajo está listo y testeado localmente → **Pull Request a `develop`**
3. Una vez aprobado y probado en staging → **Pull Request a `main`** (Producción)

> ⚠️ **Regla de oro:** Nunca hacer merge manual ni push directo a `main`. Todo pasa por Pull Request.

Para más detalles, consultá el archivo [GIT_GUIDELINES.md](./GIT_GUIDELINES.md).

---

## Arquitectura de Carpetas

El proyecto sigue la estructura estándar de Astro, adaptada a las necesidades del equipo:

```
HEM2026/
│
├── src/                        # Código fuente principal
│   ├── pages/                  # Rutas y páginas (cada archivo = una ruta)
│   │   ├── index.astro         # Página principal (/)
│   │   └── ...
│   ├── components/             # Componentes reutilizables (.astro, .tsx, .jsx)
│   ├── layouts/                # Layouts base (header, footer, estructura general)
│   ├── styles/                 # CSS global, variables y design tokens
│   └── lib/                    # Utilidades, helpers e integración con Supabase
│       └── supabase.ts         # Cliente de Supabase configurado
│
├── public/                     # Assets estáticos (imágenes, favicons, fonts)
│   └── favicon.svg
│
├── .env.example                # Variables de entorno de ejemplo (SIN secrets)
├── astro.config.mjs            # Configuración de Astro
├── package.json                # Dependencias y scripts
├── tsconfig.json               # Configuración de TypeScript
│
├── README.md                   # Este archivo
├── GIT_GUIDELINES.md           # Guía de contribución y control de versiones
├── BEST_PRACTICES.md           # Buenas prácticas y uso de IA
├── LICENSE                     # Licencia del proyecto
└── .gitignore                  # Archivos ignorados por Git
```

> **Nota:** Los archivos de Astro (`src/`, `public/`, `astro.config.mjs`, etc.) se generarán al inicializar el proyecto con `npm create astro@latest`.

---

## Gestión de Equipos

El proyecto cuenta con un sistema robusto de conformación de equipos integrado con Supabase:
- **Autonomía:** Los participantes crean y se unen a equipos mediante un código privado de 6 caracteres.
- **Validaciones RLS y RPCs:** Se valida en base de datos el tamaño del equipo (min 3, max 5) y las reglas de egresados (máximo 1 por equipo).
- **Control Administrativo:** La visualización de la sección en el dashboard de participantes es controlada por el switch `teams_enabled` en la tabla `event_config`, que el administrador puede manipular desde `/admin`.
- **Realtime:** Los cambios en los integrantes del equipo se reflejan en tiempo real para todos los participantes usando Supabase Realtime.

---

## Entrega de Proyectos

El módulo de entrega de proyectos finales permite a los equipos subir su solución tecnológica el día del evento:
- **Control Administrativo:** Activado/desactivado en tiempo real mediante el switch `project_submission_enabled` desde el panel de administración.
- **Acceso Restringido:** Solo el líder del equipo tiene permisos para crear, editar y enviar la información del proyecto (`UPSERT`).
- **Vista de Integrantes:** Los demás miembros del equipo tienen acceso de solo lectura (formulario bloqueado) garantizando consistencia de los datos.
- **Campos Solicitados:** Título, Descripción del Problema, Descripción de la Solución, Link al Prototipo y Material de Apoyo (Opcional).

---

## Tests End-to-End (Playwright)

La suite automatizada cubre el flujo completo de la app con todos los roles:
registro y onboarding de participante, creación de equipo y unión por código,
entrega de proyecto, aprobación de juez, votación en dos fases
(preclasificación → finalistas → ronda final) y controles de seguridad
(redirecciones del middleware, escalación de roles y RLS por fase).

```bash
npm run test:e2e          # corre los 14 tests (levanta el dev server solo)
npx playwright show-report # ver el reporte HTML de la última corrida
```

Notas importantes:
- Corre contra la **base real de Supabase** (no hay entorno local de DB). Los
  usuarios de prueba usan emails `e2e.*@hem2026.test` y equipos `Equipo E2E *`
  para poder identificarlos y limpiarlos después.
- Requiere el usuario admin de prueba `e2e.admin@hem2026.test` ya creado en la
  base (bootstrapeado por única vez; ver `tests/e2e/utils.ts`).
- Los tests son **seriales** (comparten estado del run) y cada corrida genera
  usuarios nuevos con sufijo único.
- Limpieza de datos de prueba (SQL): borrar `evaluations`/`projects`/`teams`
  asociados y luego `auth.users` con email `e2e.%@hem2026.test` (conservando
  el admin e2e).

Las mejoras pendientes detectadas por la suite están en [BACKLOG.md](./BACKLOG.md).

---

## Documentación del Proyecto

| Documento | Descripción |
|-----------|-------------|
| [README.md](./README.md) | Visión general del proyecto (este archivo) |
| [ESTADO_ACTUAL.md](./ESTADO_ACTUAL.md) | Estado de la rama de trabajo y pendientes de la última sesión |
| [BACKLOG.md](./BACKLOG.md) | Mejoras pendientes de aprobación o implementación |
| [Playbook_de_QA.md](./Playbook_de_QA.md) | Plan de pruebas E2E manual para Beta Testers |
| [GIT_GUIDELINES.md](./GIT_GUIDELINES.md) | Convenciones de ramas, commits y Pull Requests |
| [BEST_PRACTICES.md](./BEST_PRACTICES.md) | Estándares de calidad, testing y uso responsable de IA |
| [LICENSE](./LICENSE) | Licencia del proyecto |

---

## Equipo

Proyecto desarrollado por estudiantes de:
- **IES 9-023** — Instituto de Educación Superior
- **IES Tomás Alva Edison** — Instituto de Educación Superior

---

*Hackathon EduTech Mendoza 2026 — Construyendo el futuro de la educación con tecnología.*
