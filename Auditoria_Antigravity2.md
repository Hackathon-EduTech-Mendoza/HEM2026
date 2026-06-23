# Auditoría de Calidad y Rendimiento Móvil (HEM2026) 📱🚀

**Entorno Auditado:** Producción (`https://www.hackathonedutech.com.ar/`)  
**Metodología:** Análisis estático de código, Lighthouse Mobile Emulation, e inspección de recursos en producción.

---

## 🔍 Diagnóstico de Auditorías Previas: ¿Qué sigue pendiente?

Al contrastar el estado actual del repositorio con las auditorías de mayo de 2026 (`ayudas_y_recursos/terminados/Auditoria`), se observan excelentes avances, pero persisten algunos puntos críticos:

*   **P1 (Video de fondo de 7.7MB):** **Parcialmente resuelto.** Se reemplazaron los pesados archivos `.webm` por 5 archivos `.mp4` más optimizados (~1 a 2MB cada uno) en `public/videos/`. Sin embargo, en dispositivos móviles, descargar e iniciar la reproducción de un video de 2MB below-the-fold sigue consumiendo ancho de banda innecesario.
*   **P2 y P6 (Logos de 168KB y dimensiones explícitas):** **Resuelto.** El proyecto ahora utiliza la etiqueta `<Image>` de Astro, la cual realiza compresión automática a WebP y define dimensiones estáticas, eliminando riesgos de Cumulative Layout Shift (CLS).
*   **P3 (Fuentes de Google render-blocking):** **Resuelto.** Se implementó `@fontsource/lexend` en `Layout.astro` eliminando consultas externas de DNS.
*   **P4 (Carga innecesaria de Supabase JS):** **Pendiente.** La biblioteca `@supabase/ssr` se importa de manera estática en `Navbar.astro` para verificar la sesión del usuario. Dado que el navbar está presente en todas las páginas, esto añade **~47 KB de JS bloqueante** al Landing Page para todos los visitantes anónimos.
*   **P5 y P8 (Lazy loading y Skip Links):** **Resuelto.** Las imágenes de la galería poseen `loading="lazy"` y se añadió el enlace de salto accesible en `Layout.astro`.
*   **A11Y-1 y A11Y-2 (Contraste y jerarquía en Footer):** **Resuelto.** Se corrigieron los colores y se cambió la etiqueta `<h4>` a `<p class="ftr-heading">`.

---

## 🛠️ 5 Cambios Quirúrgicos Priorizados

A continuación, se presentan las 5 propuestas quirúrgicas diseñadas para aplicarse directamente sobre los archivos Astro del proyecto.

### 1. [Performance] Carga Diferida de Supabase en el Navbar
**Problema:** La importación estática de `@supabase/ssr` dentro de `Navbar.astro` introduce una penalización de rendimiento en la página de inicio (landing) para el 95%+ de los usuarios que no han iniciado sesión. Dado que el proyecto usa SSR (`output: 'server'`), la verificación en el cliente es secundaria y solo sirve como resguardo.
**Archivo:** [Navbar.astro](file:///c:/Repositorios_Locales/Proyectos_Personales/HEM2026/src/components/Navbar.astro)

```diff
-    // Update Auth buttons on client-side (important for SSG landing page)
-    import { createBrowserClient } from '@supabase/ssr';
-
-    const supabase = createBrowserClient(
-        import.meta.env.PUBLIC_SUPABASE_URL,
-        import.meta.env.PUBLIC_SUPABASE_ANON_KEY
-    );
+    // Carga perezosa del cliente Supabase solo si existe una cookie de sesión activa
+    async function getSupabaseClient() {
+        const hasSession = document.cookie.split(';').some(c => c.trim().startsWith('sb-'));
+        if (!hasSession) return null;
+        
+        const { createBrowserClient } = await import('@supabase/ssr');
+        return createBrowserClient(
+            import.meta.env.PUBLIC_SUPABASE_URL,
+            import.meta.env.PUBLIC_SUPABASE_ANON_KEY
+        );
+    }

     // Naming dinámico por rol (mirror de la función del servidor)
     function getClientPanelInfo(role: string | undefined) {
         ...
     }

     async function checkAuth() {
         try {
+            const supabase = await getSupabaseClient();
+            if (!supabase) return; // Si no hay cookie, evitamos inicializar Supabase y descargar el script
+
             const { data: { session } } = await supabase.auth.getSession();
             const navbarEl = document.getElementById('navbar');
```
* **Impacto:** Reduce el tamaño del bundle de JavaScript de la página de inicio en **~47KB** para visitas anónimas, mejorando el First Input Delay (FID) y reduciendo el bloqueo del hilo principal.

---

### 2. [Anti-Stacking UX] Carrusel Horizontal para Ediciones Anteriores
**Problema:** `PreviousEditions.astro` renderiza 22 tarjetas verticalmente en pantallas móviles. Esto crea Doom Scrolling y fatiga cognitiva.
**Archivo:** [PreviousEditions.astro](file:///c:/Repositorios_Locales/Proyectos_Personales/HEM2026/src/components/PreviousEditions.astro)

```diff
   .projects-grid {
     display: grid;
     grid-template-columns: 1fr;
     gap: 2rem;
   }
 
+  @media (max-width: 767px) {
+    .projects-grid {
+      display: flex;
+      flex-direction: row;
+      overflow-x: auto;
+      scroll-snap-type: x mandatory;
+      gap: 1.25rem;
+      padding: 0.5rem 0.5rem 1.5rem;
+      scrollbar-width: none; /* Firefox */
+      -ms-overflow-style: none; /* IE10+ */
+    }
+    .projects-grid::-webkit-scrollbar {
+      display: none; /* WebKit (Chrome/Safari) */
+    }
+    .project-card {
+      scroll-snap-align: center;
+      flex: 0 0 82vw; /* Deja ver el borde de la siguiente tarjeta */
+    }
+  }
+
   @media (min-width: 768px) {
     .projects-grid {
       grid-template-columns: repeat(2, 1fr);
     }
   }
```
* **Impacto:** Convierte un listado vertical larguísimo en una experiencia de carrusel táctil suave y nativo.

---

### 3. [Anti-Stacking UX] Galería Bento Rediseñada para Móvil
**Problema:** La grilla de imágenes y videos en `VibeCheck.astro` se apila en 6 filas continuas en pantallas pequeñas.
**Archivo:** [VibeCheck.astro](file:///c:/Repositorios_Locales/Proyectos_Personales/HEM2026/src/components/VibeCheck.astro)

```diff
   .vibe-grid {
     display: grid;
     grid-template-columns: 1fr;
     gap: 1.25rem;
   }
 
+  @media (max-width: 767px) {
+    .vibe-grid {
+      display: flex;
+      overflow-x: auto;
+      scroll-snap-type: x mandatory;
+      gap: 1rem;
+      padding: 0.5rem 0.5rem 1.5rem;
+      scrollbar-width: none;
+    }
+    .vibe-grid::-webkit-scrollbar {
+      display: none;
+    }
+    .vibe-item {
+      scroll-snap-align: center;
+      flex: 0 0 85vw;
+      height: 320px;
+    }
+    .vibe-video-slot {
+      aspect-ratio: auto;
+      max-height: none;
+    }
+  }
```
* **Impacto:** Las imágenes se descubren de manera interactiva a través de un scroll horizontal fluido en móvil.

---

### 4. [Performance] Bloqueo de Descarga de Video en Dispositivos Móviles
**Problema:** El componente de galería descarga un video aleatorio de ~2MB en segundo plano incluso en conexiones 4G/5G lentas en móvil, bloqueando recursos de red.
**Archivo:** [VibeCheck.astro](file:///c:/Repositorios_Locales/Proyectos_Personales/HEM2026/src/components/VibeCheck.astro)

```diff
   function initGallery() {
-    // 1. Lógica Aleatoria de Video Nativo (1 de 5)
-    const videoPool = Array.from({ length: 5 }, (_, i) => `/videos/vibe-${i + 1}.mp4`);
-    const selectedVideo = videoPool[Math.floor(Math.random() * videoPool.length)];
-    const videoPlayer = document.getElementById('vibe-player') as HTMLVideoElement;
-    if (videoPlayer) {
-      videoPlayer.src = selectedVideo;
-      videoPlayer.load(); // Cargar la fuente de video asignada
-    }
+    const isMobile = window.matchMedia('(max-width: 767px)').matches;
+    const videoPlayer = document.getElementById('vibe-player') as HTMLVideoElement;
+
+    if (isMobile) {
+      // En móvil, eliminamos el contenedor de video o mostramos un póster estático
+      if (videoPlayer) {
+        videoPlayer.style.display = 'none';
+        const slot = videoPlayer.parentElement;
+        if (slot) {
+          // Reemplazar visualmente con una foto de respaldo estática
+          slot.style.backgroundImage = "url('/img/gallery/foto-1.webp')";
+          slot.style.backgroundSize = "cover";
+          slot.style.backgroundPosition = "center";
+        }
+      }
+    } else {
+      // 1. Lógica Aleatoria de Video Nativo para Desktop
+      const videoPool = Array.from({ length: 5 }, (_, i) => `/videos/vibe-${i + 1}.mp4`);
+      const selectedVideo = videoPool[Math.floor(Math.random() * videoPool.length)];
+      if (videoPlayer) {
+        videoPlayer.src = selectedVideo;
+        videoPlayer.load();
+      }
+    }
```
* **Impacto:** Ahorro directo de hasta **2 MB de ancho de banda** en la primera carga móvil.

---

### 5. [Whitespace] Consolidación de Paddings y Espaciados de Sección
**Problema:** Grandes paddings de `8rem` y margins superiores de `6rem` distancian excesivamente los bloques lógicos de la web en pantallas móviles.
**Archivos:** [global.css](file:///c:/Repositorios_Locales/Proyectos_Personales/HEM2026/src/styles/global.css) y [Schedule.astro](file:///c:/Repositorios_Locales/Proyectos_Personales/HEM2026/src/components/Schedule.astro)

```diff
/* global.css */
 .section-padding {
     padding: 6rem 0;
 }
+@media (max-width: 767px) {
+    .section-padding {
+        padding: 3rem 0;
+    }
+}

/* Schedule.astro */
     .schedule {
         padding: 8rem 0;
         background: var(--bg-2);
         transition: background var(--t-theme);
     }
+    @media (max-width: 767px) {
+        .schedule {
+            padding: 4rem 0;
+        }
+    }
     .schedule-hdr {
         margin-bottom: 6rem;
     }
+    @media (max-width: 767px) {
+        .schedule-hdr {
+            margin-bottom: 2.5rem;
+        }
+    }
```
* **Impacto:** Estructura visual más compacta, coherente y fácil de escanear en móvil.
