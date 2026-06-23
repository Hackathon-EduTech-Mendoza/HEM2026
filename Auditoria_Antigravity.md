# Auditoría Antigravity: Mobile UX & Performance 🚀

Tras analizar el entorno de producción y el código fuente de la plataforma bajo métricas estrictas de Core Web Vitals y diseño centrado en el usuario (Mobile-First), he identificado 5 puntos críticos donde el diseño actual genera "fatiga visual" por apilamiento y penaliza gravemente los tiempos de carga (LCP).

Aquí tienes **5 cambios quirúrgicos y priorizados** para elevar drásticamente la elegancia y velocidad en móvil, manteniendo intacta la versión Desktop.

---

### 1. [Performance LCP] Destrabar el texto del Hero
**Problema:** En `Hero.astro`, el título principal (que es el elemento de mayor peso visual o LCP) tiene `opacity: 0` y un retraso de animación (`animation-delay: 0.2s`). Esto significa que la pantalla blanca bloquea el LCP por casi 1 segundo completo. Según los estándares de rendimiento (y la guía de diseño *Impeccable*), nunca se debe ocultar el contenido principal mediante opacidad para luego revelarlo, ya que los motores de renderizado lo penalizan.
**Archivo:** `src/components/Hero.astro`
**Cambio:** Eliminar el `opacity: 0` y modificar el `fadeUp` para que solo anime el desplazamiento vertical (transform) o que se aplique solo a elementos secundarios.
```css
/* ELIMINAR O COMENTAR ESTO en .hero-title, .hero-desc, etc. */
/* opacity: 0; */
/* animation: fadeUp 0.7s var(--ease) forwards; */
```

### 2. [Anti-Stacking UX] Carrusel de Ediciones Anteriores
**Problema:** En `PreviousEditions.astro`, la grilla de proyectos (`.projects-grid`) apila **22 tarjetas verticalmente** en móvil (`grid-template-columns: 1fr;`). Esto genera un scroll infinito (Doom Scrolling) que fatiga al usuario y rompe la jerarquía.
**Archivo:** `src/components/PreviousEditions.astro`
**Cambio:** Convertir la grilla en un carrusel de desplazamiento horizontal nativo (CSS Scroll Snap) exclusivo para pantallas pequeñas.
```css
/* Modificar .projects-grid */
.projects-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

@media (max-width: 767px) {
  .projects-grid {
    flex-direction: row;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding-bottom: 1rem;
    /* Ocultar scrollbar para mayor elegancia */
    scrollbar-width: none; 
  }
  .projects-grid::-webkit-scrollbar { display: none; }
  
  .project-card {
    scroll-snap-align: center;
    flex: 0 0 85%; /* Las tarjetas ocupan el 85% de la pantalla, dejando ver un asomo de la siguiente */
  }
}

@media (min-width: 768px) {
  .projects-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### 3. [Anti-Stacking UX] Galería VibeCheck en Carrusel
**Problema:** Al igual que las ediciones, la galería de fotos en `VibeCheck.astro` (`.vibe-grid`) apila 6 elementos de forma vertical en móvil.
**Archivo:** `src/components/VibeCheck.astro`
**Cambio:** Aplicar el mismo patrón de carrusel horizontal con *scroll snap* para que el usuario deslice (swipe) las fotos hacia los costados.
```css
@media (max-width: 767px) {
  .vibe-grid {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 1rem;
    scrollbar-width: none;
  }
  .vibe-grid::-webkit-scrollbar { display: none; }

  .vibe-item {
    flex: 0 0 90%;
    scroll-snap-align: center;
  }
}
```

### 4. [Whitespace] Optimización de Paddings en Móvil
**Problema:** Componentes como `Schedule.astro` y `Allies.astro` utilizan `padding: 8rem 0;` (128px de aire vertical) como base. En una pantalla móvil, esto equivale a casi un tercio de la pantalla completamente vacío entre secciones, desconectando el contenido.
**Archivos:** `src/components/Schedule.astro` y `src/styles/global.css` (para `.section-padding`).
**Cambio:** Añadir *Media Queries* quirúrgicas para reducir el padding a la mitad en móviles.
```css
/* En Schedule.astro */
.schedule {
  padding: 8rem 0;
}
@media (max-width: 767px) {
  .schedule {
    padding: 4rem 0; /* Espaciado mucho más compacto y elegante */
  }
}

/* En global.css */
.section-padding {
  padding: 6rem 0;
}
@media (max-width: 767px) {
  .section-padding {
    padding: 3.5rem 0;
  }
}
```

### 5. [Performance] Descubrimiento de Imágenes en VibeCheck
**Problema:** En `VibeCheck.astro`, las imágenes de la galería nacen sin un atributo `src` en el HTML, y se inyectan dinámicamente mediante JavaScript (`img.src = selectedPhotos[index]`). Esto ciega por completo al *Preload Scanner* del navegador móvil; las imágenes no empezarán a descargarse hasta que todo el HTML, CSS y JS hayan sido procesados y ejecutados.
**Archivo:** `src/components/VibeCheck.astro`
**Cambio:** Asignar un `src` base por defecto directamente en el HTML de Astro para las primeras 2 o 3 imágenes, y dejar que el script solo sobreescriba si es necesario barajar. Además, usar la etiqueta `<picture>` moderna si tienes diferentes formatos.
```html
<!-- En lugar de: -->
<img class="vibe-photo" alt="..." loading="lazy" />

<!-- Inyectar un src válido de Astro en el server-side: -->
<img class="vibe-photo" src="/img/gallery/foto-1.webp" alt="Momento Hackathon" loading="lazy" />
```
*(Y ajustar el JS para que baraje en base a los que ya están puestos o que no reemplace la primera foto para asegurar un renderizado temprano).*

---
*Fin de la auditoría. Si deseas aplicar alguno de estos bloques de código, dímelo y me encargo.*
