# Plan de Auditoría y Mejora — Landing Page & UX/UI Pública
> HEM2026 — Hackathon EduTech Mendoza 2da Edición
> Fecha: 17/05/2026 | Estado: PLAN (solo lectura, sin cambios de código)

---

## 1. RESUMEN EJECUTIVO

La landing page está funcional con 4 secciones (Hero, InfoCards, Schedule, FAQ) + página de ediciones + registro/login. El motor de la app funciona, pero la "carrocería" tiene varios problemas que afectan la percepción profesional del evento, especialmente al compartir el link por WhatsApp (sin OG image) y en la experiencia móvil.

**Nota sobre marca:** Los PDFs del Manual de Marcas no pudieron leerse directamente (formato binario), pero se verificó que los 5 logos oficiales están en `public/img/brand/` y los colores del design system (`--c1: #88007b` fucsia, `--c2: #9fc637` verde) coinciden con las variantes de logo disponibles. Se asume cumplimiento de norma de marca pending confirmación visual del PDF.

---

## 2. HALLAZGOS POR SEVERIDAD

### P0 — BUGS / LINKS ROTOS

| # | Componente | Problema | Impacto |
|---|-----------|----------|---------|
| **B1** | Hero.astro:62 | CTA "Inscribirse ahora" → `href="#registro"` pero **no existe** ningún elemento con `id="registro"` en la landing. El formulario está en `/registro` (página separada). | Click no hace nada. Usuarios confundidos. |
| **B2** | Footer.astro:28 | "Bases y Condiciones" → `href="#"` (placeholder muerto) | Link roto. Crítico porque las Bases son documento obligatorio según formulario de inscripción. |
| **B3** | Footer.astro:29 | "Contacto" → `href="#"` (placeholder muerto) | Link roto. No hay forma de contactar al equipo. |

### P1 — SEO / COMPARTIBILIDAD (Alto impacto de percepción)

| # | Componente | Problema | Impacto |
|---|-----------|----------|---------|
| **S1** | Layout.astro `<head>` | **Sin etiquetas Open Graph** (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) | Al compartir por WhatsApp/Facebook/LinkedIn: sin título, sin imagen, sin descripción. Parece un link genérico. |
| **S2** | Layout.astro `<head>` | **Sin Twitter Card tags** (`twitter:card`, `twitter:title`, `twitter:image`) | Compartir en X/Twitter muestra preview vacía. |
| **S3** | Layout.astro `<head>` | **Sin `og:image`** — hay 5 logos de marca en `public/img/brand/` pero ninguno se usa como meta image | Imagen de preview inexistente. El logo MARCA_COMPLETA_COLOR sería ideal como OG image. |
| **S4** | Layout.astro `<head>` | **Sin `<link rel="canonical">`** | Riesgo de contenido duplicado en indexación. |
| **S5** | Layout.astro `<head>` | **Sin JSON-LD structured data** (Event schema, Organization schema) | Perdida de rich results en Google (evento con fecha, lugar, organizadores). |
| **S6** | astro.config.mjs | **Sin `@astrojs/sitemap`** | No hay sitemap.xml generado. Google no puede descubrir páginas eficientemente. |
| **S7** | Layout.astro `<head>` | **Sin `<meta name="theme-color">`** | Browser mobile no adapta color de barra de navegación a la marca. |

### P2 — UX / CONTENIDO vs BASES Y CONDICIONES

| # | Componente | Problema | Referencia (Bases/Formulario) |
|---|-----------|----------|------------------------------|
| **C1** | Hero.astro:26-28 | Descripción genérica: "Un espacio intensivo de trabajo colaborativo donde equipos interdisciplinarios diseñan soluciones tecnológicas innovadoras para los desafíos actuales de la educación." | Falta mención de "Nivel Superior" (dato clave del formulario y Bases). |
| **C2** | InfoCards.astro:37 | Modalidad: "Equipos de 3 a 5 personas con perfiles diversos: pedagógicos, técnicos, tecnológicos, comunicacionales y creativos." | El formulario dice "Máx. 2 perfiles docentes y 2 técnicos" — esta restricción no aparece en la landing. Información incompleta. |
| **C3** | InfoCards.astro — Sedes | Menciona "Espacio Cultural Julio Le Parc" y "Escuela Edison" sin aclarar que Edison = IES Tomás Alva Edison | Falta nombre completo de la institución. |
| **C4** | Schedule.astro | Faltan horarios exactos del Sábado en sede Edison vs Le Parc (solo dice "Edison (mañana) + Le Parc (tarde)" en el header) | El cronograma detallado por sede está implícito pero no explícito en el header del día. |
| **C5** | FAQ.astro | 6 preguntas, pero faltan FAQ clave: "¿Qué necesito llevar?", "¿Hay certificado?", "¿Puedo participar si soy de otra provincia?", "¿Qué pasa si no tengo equipo?" | FAQ insuficiente para las dudas más frecuentes reales. |
| **C6** | Landing — General | **No hay sección de Premios** | Las Bases mencionan 1er, 2do y 3er lugar + mención a Beca Incubadora UNCUYO (como ganó ArcoEdu). Esto es un motivador clave que no aparece. |
| **C7** | Landing — General | **No hay sección de Sponsor/Organizadores** con logos | Solo hay texto en el footer. Sin logos de IES 9-023, IES Edison, ni posibles sponsors. |

### P3 — RESPONSIVE / ACCESIBILIDAD

| # | Componente | Problema | Impacto |
|---|-----------|----------|---------|
| **R1** | Navbar.astro:178-189 | `@media (min-width: 768px)` usa `display: flex !important` — salta abruptamente de overlay fullscreen a inline. No hay breakpoint intermedio para tablets. | En tablets 768px puede verse apretado o con overflow. |
| **R2** | Footer.astro:150-158 | Mobile: `flex-direction: column` pero las 3 columnas de links quedan apiladas sin separación visual | Footer muy largo en mobile sin indicadores de sección. |
| **R3** | Schedule.astro:356-362 | `@media (min-width: 768px)` cambia de column a row — salto abrupto sin breakpoint intermedio | En tablets las actividades pueden verse desalineadas. |
| **R4** | Hero.astro:306-310 | Countdown gap baja de 24px a 12px en `max-width: 640px` — pero los números del countdown (`clamp(2.5rem, 5vw, 3.5rem)`) pueden desbordar en pantallas muy chicas (<360px) | Overflow horizontal posible en dispositivos pequeños. |
| **R5** | Navbar.astro | Auth buttons no tienen focus visible styling para navegación por teclado | Accesibilidad: no se puede navegar con Tab fácilmente. |
| **R6** | FAQ.astro:160 | `DOMContentLoaded` event listener — puede no disparar si el script se carga después del DOM ready | FAQ puede quedar no-interactiva en ciertos escenarios de carga. |

### P4 — CONSISTENCIA VISUAL / DETALLES

| # | Componente | Problema |
|---|-----------|----------|
| **D1** | registro.astro:194-201 | `.form-error` usa hardcoded `rgba(220, 38, 38, ...)` y `#dc2626` — mismo problema que ya corregimos en dashboard. |
| **D2** | Navbar + Footer | Mismo `alt="Hackathon EduTech"` en ambas imágenes de logo — un screen reader lee el mismo texto dos veces. Footer debería usar `alt=""` (decorativo). |
| **D3** | src/assets/ | `background.svg` y `astro.svg` son boilerplate de Astro, no se usan en ningún componente. Basura. |
| **D4** | Layout.astro | Google Fonts carga `Lexend:wght@200;400;900` pero el design system usa pesos 600 (`.section-label`, `.btn`, etc.) que no están en el `@import` — el browser sintetiza el peso, degradando la calidad tipográfica. |
| **D5** | Hero.astro | No hay `aria-live` en el countdown — lectores de pantalla no son notificados de los cambios. |
| **D6** | PreviousEditions.astro | 22 proyectos hardcodeados en un array — cuando se agreguen proyectos de 2026, hay que editar el componente a mano. Considerar fetch desde Supabase o archivo JSON. |
| **D7** | Layout.astro | `<meta name="description">` es genérico: "Plataforma web oficial..." — debería ser más atractivo y contener palabras clave ("hackathon", "educación", "Mendoza", "Nivel Superior"). |

---

## 3. PLAN DE ACCIÓN (orden de ejecución propuesto)

### FASE 1 — Quick Wins (bugs + SEO crítico)
Prioridad máxima. Cosas que rompen la experiencia o la percepción profesional.

| Tarea | Archivos | Estimado |
|-------|----------|----------|
| **T1** Fix CTA Hero: `#registro` → `/registro` | `Hero.astro` | 5 min |
| **T2** Fix footer links: "Bases y Condiciones" → link al PDF o sección descargable. "Contacto" → mailto o sección de contacto | `Footer.astro` | 15 min |
| **T3** Agregar Open Graph + Twitter Card meta tags al Layout (con og:image usando MARCA_COMPLETA_COLOR) | `Layout.astro` | 20 min |
| **T4** Agregar `<link rel="canonical">`, `<meta name="theme-color">`, `<meta name="robots">` | `Layout.astro` | 10 min |
| **T5** Instalar `@astrojs/sitemap`, agregar a config, agregar `site` URL | `astro.config.mjs` | 15 min |
| **T6** Agregar JSON-LD structured data (Event + Organization) | `Layout.astro` o componente nuevo | 20 min |

### FASE 2 — Contenido alineado con Bases
Cargar datos definitivos según Bases y Condiciones.

| Tarea | Archivos | Estimado |
|-------|----------|----------|
| **T7** Hero: actualizar descripción incluyendo "Nivel Superior" | `Hero.astro` | 5 min |
| **T8** InfoCards: agregar restricción de perfiles (máx 2 docentes + 2 técnicos) + nombre completo "IES Tomás Alva Edison" | `InfoCards.astro` | 10 min |
| **T9** Agregar sección "Premios" (1er, 2do, 3er lugar + Beca Incubadora) | Nuevo componente + `index.astro` | 30 min |
| **T10** Agregar sección "Organizan" con logos institucionales (IES 9-023, IES Edison) | Nuevo componente + `index.astro` | 30 min |
| **T11** Expandir FAQ: agregar 4-6 preguntas más ("¿Qué necesito llevar?", "¿Hay certificado?", etc.) | `FAQ.astro` | 15 min |
| **T12** Crear página 404 personalizada | `src/pages/404.astro` | 20 min |

### FASE 3 — Responsive & Accesibilidad
Pulir la experiencia móvil y de teclado.

| Tarea | Archivos | Estimado |
|-------|----------|----------|
| **T13** Navbar: agregar focus-visible styling en links y botones | `Navbar.astro` + `global.css` | 15 min |
| **T14** Navbar: mejorar breakpoint tablet (probar a 860px+) | `Navbar.astro` | 15 min |
| **T15** Footer mobile: agregar separadores visuales o accordion | `Footer.astro` | 20 min |
| **T16** Hero countdown: agregar safeguards contra overflow en <360px | `Hero.astro` | 10 min |
| **T17** Countdown: agregar `aria-live="polite"` | `Hero.astro` | 5 min |

### FASE 4 — Consistencia & Detalles
Cosas que no rompen pero dejan el código más limpio y profesional.

| Tarea | Archivos | Estimado |
|-------|----------|----------|
| **T18** registro.astro: reemplazar hardcoded red colors por CSS variables (como ya se hizo en dashboard) | `registro.astro` | 5 min |
| **T19** Footer logo: cambiar `alt` a `alt=""` (decorativo, ya está en navbar) | `Footer.astro` | 2 min |
| **T20** Eliminar `src/assets/background.svg` y `src/assets/astro.svg` (boilerplate) | `src/assets/` | 2 min |
| **T21** Google Fonts: agregar peso 600 al import (`Lexend:wght@200;400;600;900`) | `Layout.astro` | 2 min |
| **T22** Meta description: reescribir para ser más atractiva y con keywords | `Layout.astro` | 5 min |
| **T23** FAQ script: usar `requestAnimationFrame` o check `document.readyState` en vez de solo `DOMContentLoaded` | `FAQ.astro` | 5 min |

---

## 4. DECISIONES PENDIENTES (requieren input del equipo)

| # | Decisión | Opciones |
|---|----------|----------|
| **Q1** | ¿Dónde apuntar "Bases y Condiciones"? | a) Upload del DOCX como descargable en `/public/docs/` b) Página dedicada `/bases-y-condiciones` con el contenido renderizado c) Link a Google Drive |
| **Q2** | ¿Cómo manejar "Contacto"? | a) `mailto:organizacion@hackathonedutech.ar` b) Sección de contacto con formulario c) Link a WhatsApp del organizador |
| **Q3** | ¿Hay sponsors confirmados para mostrar? | a) Sí → agregar sección/ componente b) No → solo mostrar logos de organizadores por ahora |
| **Q4** | ¿La OG image debe ser el logo o una imagen custom diseñada? | a) Logo MARCA_COMPLETA_COLOR (ya existe) b) Banner diseñado 1200x630px con info del evento (requiere diseño) |
| **Q5** | ¿El JSON-LD de Event requiere la URL de producción? | a) Usar `https://hackathonedutech.com.ar` (si existe) b) Usar la URL de Vercel actual c) Hacerlo dinámico con `Astro.url` |
| **Q6** | ¿Ediciones anteriores se mantiene hardcodeado o se migra a Supabase/JSON? | a) Mantener hardcodeado (simple, 1 edición) b) Migrar a JSON estático en `/public/data/` c) Fetch desde Supabase |

---

## 5. NOTA SOBRE EL BRIEF DE MARCA (PDF)

Los PDFs en `ayudas_y_recursos/Manual_De_Marcas/` no pudieron leerse (formato binario no soportado). Se recomienda que el equipo verifique manualmente:

- [ ] Paleta de colores del manual coincide con `--c1: #88007b` y `--c2: #9fc637`
- [ ] Tipografía Lexend está aprobada por el manual (o si requieren otra)
- [ ] Uso del isotipo vs logotipo completo cumple las reglas de zona de respeto
- [ ] Fondos claros/oscuros permitidos según el manual
- [ ] Versión de logo a usar en OG image según normativa

---

## 6. ESTADO ACTUAL vs FORMULARIO DE INSCRIPCIÓN

Comparación entre lo que pide el formulario oficial y lo que muestra la landing:

| Campo del formulario | Presente en landing | Nota |
|---------------------|--------------------|-|
| "2° Hackathon Edu TECH del Nivel Superior" | Parcial — falta "Nivel Superior" en Hero | **C1** |
| "Provincia de Mendoza" | Sí (badge: "Mendoza, Argentina") | OK |
| "IES N°9-023 y IES Tomás Alva Edison" | Parcial — "Escuela Edison" sin nombre completo | **C3** |
| Fechas: 5-6 junio + virtual 3 junio | Sí (date chips + cronograma) | OK |
| Lugares: Le Parc + Edison con direcciones | Parcial — direcciones en InfoCards pero no en Hero | Menor |
| "Máx. 2 perfiles docentes y 2 técnicos" | No aparece en ninguna parte | **C2** |
| Bases y Condiciones descargables | Link roto en footer | **B2** |

---

## 7. ARQUITECTURA PROPUESTA PARA NUEVAS SECCIONES

```
index.astro (landing)
├── Hero (existente, fix CTA)
├── InfoCards (existente, ajustar contenido)
├── Prizes [NUEVO] — T9
├── Schedule (existente)
├── Organizers [NUEVO] — T10
├── FAQ (existente, expandir)
└── Footer (fix links)
```

Las nuevas secciones (Prizes, Organizers) siguen el patrón de componentes existentes: `section-padding`, `reveal` para animaciones, uso de variables CSS del design system, mismo estilo de header con `section-label` + `section-title` + `section-desc`.

---

## 8. CHECKLIST DE VERIFICACIÓN POST-IMPLEMENTACIÓN

- [ ] `astro build` pasa sin errores
- [ ] Lighthouse SEO score > 90
- [ ] OG preview verificado con https://www.opengraph.xyz/
- [ ] WhatsApp link preview muestra imagen + título
- [ ] Todos los links del footer son funcionales
- [ ] Hero CTA navega a `/registro` correctamente
- [ ] Responsive verificado en 360px, 768px, 1024px, 1440px
- [ ] Navegación por teclado (Tab) funcional en navbar
- [ ] Meta description < 160 caracteres
- [ ] sitemap.xml accesible en `/sitemap-index.xml`
