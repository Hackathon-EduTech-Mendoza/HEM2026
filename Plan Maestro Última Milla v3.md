# Plan Maestro Última Milla v3

> HEM2026 — Hackathon EduTech Mendoza 2da Edición
> Fecha: 18/05/2026 | Estado: LISTO PARA IMPLEMENTAR

---

## Resumen

3 fases, ~40 tareas, estimación total ~8-10 horas de trabajo.

---

## FASE 1: Refactorización DB y Lógica (auto-aprobación + buscador admin)

### 1.1 — Migración SQL: auto-aprobación

- **Archivo**: nueva migración `supabase/migrations/20260518_auto_approval.sql`
- Cambiar default de `registration_status` de `'pendiente'` a `'aprobado'` (para nuevos signups vía trigger)
- UPDATE masivo: `UPDATE profiles SET registration_status = 'aprobado' WHERE registration_status = 'pendiente' AND dni IS NOT NULL AND institution IS NOT NULL`
- Mantener valores existentes para usuarios rechazados (no tocar)

### 1.2 — Dashboard onboarding: setear `aprobado` al completar perfil

- **Archivo**: `src/pages/dashboard/index.astro:742-751`
- Agregar `registration_status: 'aprobado'` al `.update()` del profile-form
- Eliminar `window.location.reload()` post-submit (ya que el onboarding setea aprobado, el SSR renderizará correctamente la vista completa al recargar)

### 1.3 — Dashboard: eliminar UI de estado "pendiente"

- **Archivo**: `src/pages/dashboard/index.astro`
- Línea 184: eliminar condición `|| 'pendiente'` → siempre usa `profile.registration_status`
- Líneas 323-328: eliminar el bloque completo `{profile.registration_status === 'pendiente' && isProfileComplete && (...)}`
- Línea 304: la condición `profile.registration_status === 'aprobado'` se mantiene (ahora siempre será aprobado tras onboarding)
- CSS: eliminar `.status-pendiente` y su animación `pulse`

### 1.4 — Trigger BD: nuevo signup → `aprobado` por defecto

- **Archivo**: misma migración 1.1
- Modificar el trigger existente de `handle_new_user()` para que INSERT inicial de profiles use `registration_status = 'aprobado'` en vez de `'pendiente'`
- Verificar si el trigger actual lo setea explícitamente o usa el default de la columna

### 1.5 — Admin: agregar buscador en tab Usuarios

- **Archivo**: `src/pages/admin/index.astro:123-144`
- Agregar `<input type="search" id="search-users" placeholder="Buscar por nombre o DNI...">` antes de los selects de filtro
- JS: agregar listener `input` que filtre las `<tr>` de la tabla comparando `.textContent` de columnas Nombre y DNI contra el query (case-insensitive)
- CSS: estilizar el input de búsqueda con las variables del design system

### 1.6 — Admin: ocultar botón "Asignación Aleatoria"

- **Archivo**: `src/pages/admin/index.astro:416-422`
- Agregar `style="display: none;"` o clase CSS `.hidden` al botón `#assign-mentors-simple`
- Mantener el botón `#assign-mentors-reset` visible (o también ocultarlo si se decide)
- NO eliminar el botón del DOM — solo ocultar visualmente

### 1.7 — Middleware: actualizar lógica de redirección

- **Archivo**: `src/middleware.ts`
- No debería necesitar cambios (el middleware no filtra por `registration_status`), pero verificar que no haya paths que asuman `pendiente`

---

## FASE 2: Landing Page & SEO

### 2.1 — Fix CTA Hero: `#registro` → `/registro`

- **Archivo**: `src/components/Hero.astro:62`
- Cambiar `href="#registro"` por `href="/registro"`

### 2.2 — Actualizar fechas a 19/21/22 de agosto

- **Archivos**: `Hero.astro:55-58`, `Hero.astro:12`, `Schedule.astro:20,48,101`
- Hero: `"3 Jun"` → `"19 Ago"`, `"5-6 Jun"` → `"21-22 Ago"`
- Hero: fallback `eventDate` → `'2026-08-19T21:30:00-03:00'`
- Hero script: mismo fallback
- Schedule: `"Miércoles 3 de Junio"` → `"Martes 19 de Agosto"`, `"Viernes 5 de Junio"` → `"Jueves 21 de Agosto"`, `"Sábado 6 de Junio"` → `"Viernes 22 de Agosto"`

### 2.3 — Fix footer links muertos

- **Archivo**: `src/components/Footer.astro:28-29`
- `"Bases y Condiciones"` → `href="/bases-y-condiciones"` (nueva página — ver 2.4)
- `"Contacto"` → `href="mailto:hackathonedutech@gmail.com"` (o el email real)

### 2.4 — Crear página `/bases-y-condiciones`

- **Archivo nuevo**: `src/pages/bases-y-condiciones.astro`
- Layout con título, contenido de las Bases y Condiciones renderizado como HTML semántico
- Copiar contenido del DOCX/PDF de Bases (se necesita el contenido — por ahora crear placeholder con estructura)

### 2.5 — OG Tags + Twitter Cards en Layout

- **Archivo**: `src/layouts/Layout.astro:16-38`
- Agregar: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card`, `twitter:title`, `twitter:image`
- Usar `MARCA_COMPLETA_COLOR.png` como `og:image` (ya existe en `/img/brand/`)
- Hacerlos dinámicos con `Astro.props` (extender interfaz Props con `description`, `image`, etc.)

### 2.6 — Canonical + theme-color + robots

- **Archivo**: `src/layouts/Layout.astro`
- `<link rel="canonical" href={Astro.url.href}>`
- `<meta name="theme-color" content="#88007b">`
- `<meta name="robots" content="index, follow">`

### 2.7 — Instalar @astrojs/sitemap

- **Archivos**: `astro.config.mjs`, package.json
- `npm install @astrojs/sitemap`
- Agregar `sitemap()` al integrations array en config
- Agregar `site: 'https://hackathonedutech.com.ar'` (o la URL de producción)

### 2.8 — JSON-LD structured data

- **Archivo**: `src/layouts/Layout.astro` o nuevo componente `JsonLd.astro`
- Schema `Event` con nombre, fecha (19-22 agosto), ubicación (Guaymallén, Mendoza), organizador
- Schema `Organization` con nombre Hackathon EduTech, logo, sameAs

### 2.9 — Hero: actualizar descripción

- **Archivo**: `src/components/Hero.astro:26-28`
- Agregar "Nivel Superior" a la descripción: "...equipos interdisciplinarios del Nivel Superior diseñan..."

### 2.10 — InfoCards: agregar restricción perfiles + nombre completo

- **Archivo**: `src/components/InfoCards.astro:37`
- Agregar: "Máximo 2 perfiles docentes y 2 técnicos por equipo."
- Línea 28: "Escuela Edison" → "IES Tomás Alva Edison"

### 2.11 — Agregar sección Premios

- **Archivo nuevo**: `src/components/Prizes.astro`
- Tarjetas: 1er lugar, 2do lugar, 3er lugar + Mención Beca Incubadora UNCUYO
- Patrones: `.reveal`, variables CSS, `section-label` + `section-title` + `section-desc`
- **Archivo**: `src/pages/index.astro` — importar y agregar entre InfoCards y Schedule

### 2.12 — Agregar sección Organizan

- **Archivo nuevo**: `src/components/Organizers.astro`
- Logos de IES 9-023 y IES Tomás Alva Edison con links
- Patrones: misma estructura de sección que InfoCards
- **Archivo**: `src/pages/index.astro` — importar y agregar entre Schedule y FAQ

### 2.13 — Expandir FAQ

- **Archivo**: `src/components/FAQ.astro`
- Agregar: "¿Qué necesito llevar?", "¿Hay certificado?", "¿Puedo participar si soy de otra provincia?", "¿Qué pasa si no tengo equipo?"

### 2.14 — Crear página 404

- **Archivo nuevo**: `src/pages/404.astro`
- Mensaje amigable + link a inicio + diseño consistente

### 2.15 — registro.astro + login.astro: reemplazar hardcoded red colors

- **Archivos**: `registro.astro:194-201`, `login.astro:180-187`
- Reemplazar `rgba(220, 38, 38, ...)` y `#dc2626` por variables CSS `var(--danger)` y `rgba(var(--danger-r), ...)`
- Agregar variables `--danger` y `--danger-r` al design system en `global.css` si no existen (verificar que ya están del hotfix 5)

---

## FASE 3: Re-branding y UX/UI

### 3.1 — Re-branding: verde coprotagonista en Hero

- **Archivo**: `src/components/Hero.astro`
- `.t-hackathon` (línea 159-164): agregar `color: var(--c2)` en vez de `var(--txt-1)` → "HACKATHON" en verde
- `.t-edutech` (línea 166-172): mantener `var(--c1)` → "EDUTECH" en fucsia
- Alternativa: título bicolor con gradient `background: linear-gradient(135deg, var(--c2), var(--c1)); -webkit-background-clip: text;`
- Hero badge dot (línea 129): mantener verde (`var(--c2)`) ✓
- `.hero-badge` (línea 111): cambiar `color: var(--c1)` → gradient o alternancia verde/fucsia

### 3.2 — Re-branding: Hero date-chips alternancia

- **Archivo**: `src/components/Hero.astro:262`
- `.date-chip strong`: primer chip verde (`var(--c2)`), segundo fucsia (`var(--c1)`)
- Agregar `:nth-child` para alternar

### 3.3 — Re-branding: InfoCards alternancia

- **Archivo**: `src/components/InfoCards.astro`
- Ya tiene alternancia c1/c2/c1 en las cards ✓ — verificar que el peso visual es equilibrado
- Agregar gradiente sutil en el header de sección

### 3.4 — Re-branding: Schedule dots alternancia

- **Archivo**: `src/components/Schedule.astro:239-241`
- Ya alterna c1/c2/c1 ✓ — sin cambios necesarios

### 3.5 — Re-branding: botones primarios con gradiente

- **Archivo**: `src/styles/global.css`
- `.btn-primary`: cambiar de `background: var(--c1)` a `background: linear-gradient(135deg, var(--c1), var(--c2))` o mantener solid pero alternar según contexto
- `.btn-outline`: mantener border `var(--c1)` pero agregar variante `--c2`

### 3.6 — Re-branding: Countdown valores alternancia

- **Archivo**: `src/components/Hero.astro:208-209`
- `.countdown-val`: agregar gradiente de texto `background: linear-gradient(180deg, var(--c1), var(--c2)); -webkit-background-clip: text;`
- O alternar colores por item (Días=fucsia, Horas=verde, Min=fucsia, Seg=verde)

### 3.7 — Dashboard participante: rediseño con tabs/botones

- **Archivo**: `src/pages/dashboard/index.astro`
- Reemplazar layout grid `4fr/6fr` por navegación tipo tabs: "Perfil", "Equipo", "Mentoría", "SOS"
- Cada tab muestra su sección correspondiente, ocultando las demás
- En mobile: tabs como botones apilados horizontalmente (scroll si es necesario)
- En desktop: tabs como pills/botones en la parte superior del card
- Agregar JS para toggle de tabs (patrón similar al admin que ya usa tabs)

### 3.8 — Dashboard: mejorar responsive

- **Archivo**: `src/pages/dashboard/index.astro`
- Eliminar el grid `4fr/6fr` que compacta en desktop
- Usar layout de ancho completo con tabs en su lugar
- Asegurar que el formulario de contacto se vea bien en mobile

### 3.9 — Evaluación (juez): revisión responsive

- **Archivo**: `src/pages/evaluacion.astro`
- Verificar que la grilla de proyectos y el modal de evaluación funcionen en mobile
- Agregar max-width al modal para que no desborde en pantallas chicas
- Agregar scroll al modal body si el contenido excede viewport

### 3.10 — Navbar: focus-visible + breakpoint tablet

- **Archivo**: `src/components/Navbar.astro`
- Agregar `:focus-visible` styling en links y botones (outline con `var(--c2)`)
- Mover breakpoint mobile de 768px a ~860px para evitar overflow en tablets

### 3.11 — Footer mobile: mejorar separación

- **Archivo**: `src/components/Footer.astro`
- Agregar bordes superiores o spacing entre columnas en mobile
- Considerar accordion para las columnas de links en mobile

### 3.12 — Hero countdown: safeguard overflow <360px

- **Archivo**: `src/components/Hero.astro`
- Agregar `@media (max-width: 360px)` con tamaño de fuente reducido para countdown values

### 3.13 — Countdown: aria-live

- **Archivo**: `src/components/Hero.astro`
- Agregar `aria-live="polite"` al contenedor countdown para accesibilidad

### 3.14 — Google Fonts: agregar peso 600

- **Archivo**: `src/layouts/Layout.astro:27`
- Cambiar `Lexend:wght@200;400;900` → `Lexend:wght@200;400;600;900`

### 3.15 — Footer logo: alt vacío

- **Archivo**: `src/components/Footer.astro:10`
- Cambiar `alt="Hackathon EduTech"` → `alt=""`

### 3.16 — Eliminar assets basura

- **Archivos**: `src/assets/background.svg`, `src/assets/astro.svg`
- Eliminar si no son referenciados por ningún componente

### 3.17 — FAQ script: mejorar inicialización

- **Archivo**: `src/components/FAQ.astro:158-176`
- Reemplazar `DOMContentLoaded` con verificación de `document.readyState`

### 3.18 — Meta description mejorada

- **Archivo**: `src/layouts/Layout.astro:19`
- Reescribir: "Participá en la 2da Hackathon EduTech del Nivel Superior en Mendoza. Equipos interdisciplinarios, premios y mentoría. 19-22 de agosto de 2026."

### 3.19 — Navbar: link "Ediciones" apunta a /ediciones

- **Archivo**: `src/components/Navbar.astro:20`
- Verificar que `/ediciones` existe como página (debería ser `src/pages/ediciones.astro` o `ediciones/index.astro`)

---

## Orden de ejecución sugerido

1. **FASE 1 primero** (DB + lógica) — es la que tiene mayor impacto funcional y permite testear el flujo de registro end-to-end
2. **FASE 2 después** (landing + SEO) — es la cara pública y tiene bugs críticos (CTA roto, links muertos, fechas viejas)
3. **FASE 3 al final** (branding + UX) — es pulido visual que no rompe funcionalidad

Dentro de cada fase, las tareas están ordenadas de mayor a menor impacto. Las primeras de cada fase son las que más se notan.

---

## Commits propuestos

- `feat: auto-aprobación registro + migración BD` (1.1-1.4)
- `feat: buscador admin + ocultar asignación aleatoria` (1.5-1.6)
- `fix: CTA hero, fechas agosto, footer links` (2.1-2.3)
- `feat: página bases-y-condiciones` (2.4)
- `feat: OG tags, sitemap, JSON-LD, SEO` (2.5-2.8)
- `feat: contenido landing (descripción, premios, organizadores, FAQ)` (2.9-2.13)
- `feat: página 404 + fix colores auth` (2.14-2.15)
- `feat: re-branding verde/fucsia coprotagonista` (3.1-3.6)
- `feat: dashboard tabs + responsive dashboards` (3.7-3.9)
- `fix: navbar focus, footer mobile, a11y, cleanup` (3.10-3.19)
- Commit final de épica: `epic: última milla completa`

---

## Decisiones confirmadas

| Decisión | Resolución |
|----------|------------|
| Pivote registro | Auto-aprobación al completar onboarding |
| Bases y Condiciones | Página dedicada `/bases-y-condiciones` |
| Contacto | `mailto:` con email del equipo |
| Fechas evento | 19, 21 y 22 de agosto |
| Buscador admin | Barra de búsqueda por Nombre/DNI en tab Usuarios |
| Asignación aleatoria | Ocultar botón, no eliminar |
| Verde coprotagonista | Igual peso visual que fucsia (títulos bicolores, gradientes, alternancia) |
| Dashboard participante | Rediseño con tabs/botones de navegación interna |
| Rutas dedicadas | `/mentoria` para mentores, `/evaluacion` para jueces |
| Realtime reactivo | Patrón establecido (no reload) |
| RPCs para help_requests | No INSERT/UPDATE directo |

---

## Restricciones

- Proyecto usa Astro puro + vanilla CSS/JS (no Tailwind, React, Vue, Svelte)
- No modificar BD ni RPCs existentes (excepto migración de auto-aprobación)
- Todos los strings de error en español
- Usar variables CSS del design system (`global.css`), no hardcodear valores
- Commits por tarea + commit final de épica
