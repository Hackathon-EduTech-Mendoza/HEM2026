# BEST_PRACTICES.md — Buenas Prácticas y Estándares de Calidad

> Este documento define los estándares de calidad del equipo y las pautas para el uso responsable de inteligencia artificial en el desarrollo del proyecto HEM2026.

---

## 1. Guía de Uso de IA y Agentes de Código

### Principio fundamental

> **La IA es una herramienta, no un reemplazo.** Vos sos el desarrollador. La IA te asiste, pero la responsabilidad del código es tuya.

### Reglas de uso

#### ✅ Lo que SÍ hacer:

1. **Pedir tareas atómicas** — Siempre dar instrucciones pequeñas y específicas.
   - ✅ *"Creá un componente de botón con estas propiedades: ..."*
   - ❌ *"Hacé toda la página de login con autenticación"*

2. **Entender antes de implementar** — Nunca copies código que no entiendas.
   - Si la IA genera algo y no sabés qué hace, **preguntale que te lo explique**.
   - Si después de la explicación seguís sin entender, **pedí ayuda a un compañero**.

3. **Dar contexto** — Cuanto más contexto le des a la IA, mejor resultado obtenés.
   - Mencioná qué tecnologías usás (Astro, Supabase, TypeScript)
   - Describí qué querés lograr, no solo qué código querés
   - Compartí archivos relevantes si es necesario

4. **Iterar** — Si el primer resultado no es perfecto, refiná el pedido.
   - *"Está bien, pero cambiale X por Y"*
   - *"Ahora agregale manejo de errores"*

#### ❌ Lo que NO hacer:

1. **No pedir todo junto** — Las tareas grandes generan código de baja calidad.
2. **No confiar ciegamente** — La IA puede generar código incorrecto, inseguro o ineficiente.
3. **No copiar y pegar sin revisar** — Siempre leé y entendé el código antes de usarlo.
4. **No usar IA para saltear el aprendizaje** — Si no sabés CSS, aprendé CSS. La IA te ayuda a practicar, no a evitar.

### Flujo recomendado con IA

```
1. Definí qué querés hacer (en español, claro y específico)
       │
2. Pedile a la IA una tarea atómica
       │
3. Revisá el código generado
       │
4. ¿Lo entendés? ──── No ──── Pedí explicación
       │                              │
      Sí                         ¿Lo entendés ahora?
       │                              │
5. Probalo en local              No ──── Pedí ayuda humana
       │                              │
6. ¿Funciona? ──── No ──── Iterá con la IA (explicale qué falló)
       │
      Sí
       │
7. Commiteá y seguí con la próxima tarea
```

---

## 2. Estándares de Calidad y Testing

### La regla de oro

> ⚠️ **Siempre testeá en local antes de cualquier push al repositorio remoto.**

No importa qué tan seguro estés de que "funciona". Abrí tu navegador, revisá que todo se vea bien y que no se rompió nada.

### Checklist antes de hacer push

- [ ] `npm run dev` funciona sin errores
- [ ] Revisé visualmente la página en el navegador
- [ ] Probé en al menos **1 navegador** (Chrome, Firefox o Edge)
- [ ] No hay errores en la consola del navegador (F12 → Console)
- [ ] Los cambios no rompen funcionalidad existente
- [ ] Eliminé código de debug (`console.log`, comentarios temporales)
- [ ] El código sigue las convenciones del equipo (ver abajo)

### Antes de crear un Pull Request (adicional)

- [ ] `npm run build` compila sin errores
- [ ] Probé en **vista móvil** (F12 → Toggle Device Toolbar)
- [ ] Los textos visibles están en **español** (interfaz de usuario)
- [ ] El código (variables, funciones) está en **inglés**

---

## 3. Convenciones de Código

### Idiomas

| Qué | Idioma | Ejemplo |
|-----|--------|---------|
| Variables y funciones | Inglés | `getUserData()`, `isLoading` |
| Componentes | Inglés | `NavBar.astro`, `LoginForm.tsx` |
| Comentarios en código | Inglés | `// Fetch user data from Supabase` |
| Interfaz de usuario (textos visibles) | Español | `"Iniciar Sesión"`, `"Bienvenido"` |
| Documentación del proyecto | Español | README.md, GIT_GUIDELINES.md |
| Commits | Inglés | `feat: add login component` |

### Formato de archivos

- **Indentación:** 2 espacios (no tabs)
- **Fin de línea:** LF (Unix)
- **Encoding:** UTF-8
- **Punto y coma:** Sí en TypeScript/JavaScript
- **Comillas:** Simples (`'`) en JS/TS, dobles (`"`) en HTML/Astro

### Nombres de archivos

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Componentes Astro | PascalCase | `NavBar.astro` |
| Componentes React/TSX | PascalCase | `LoginForm.tsx` |
| Páginas Astro | kebab-case | `about-us.astro` |
| Utilidades/Helpers | camelCase | `formatDate.ts` |
| Estilos | kebab-case | `global-styles.css` |
| Constantes/Config | camelCase | `supabaseClient.ts` |

---

## 4. Seguridad

### Reglas fundamentales:

1. **Nunca subir secrets al repositorio** — Las API keys, tokens y contraseñas van en `.env` (que está en `.gitignore`)
2. **Usar `.env.example`** — Crear un archivo de ejemplo con las variables necesarias pero **sin valores reales**
3. **Row Level Security (RLS)** — Siempre activar RLS en las tablas de Supabase
4. **Validar inputs** — Nunca confiar en datos que vienen del usuario sin validar

### Ejemplo de `.env.example`:
```env
# Supabase
PUBLIC_SUPABASE_URL=tu_url_aqui
PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui

# Sentry
PUBLIC_SENTRY_DSN=tu_dsn_aqui
```

---

## 5. Comunicación del Equipo

- **Antes de empezar algo nuevo:** Avisá en qué vas a trabajar para evitar conflictos
- **Si encontrás un bug:** Reportalo con contexto (qué hiciste, qué esperabas, qué pasó)
- **Si estás trabado:** Pedí ayuda. No pierdas horas en algo que un compañero puede resolver en 5 minutos
- **Si rompiste algo:** Avisá inmediatamente. Todos nos equivocamos, lo importante es no ocultar errores

---

## 6. Alertas y Notificaciones

> Esta sección documenta el wrapper de SweetAlert2 usado en el proyecto. Reemplaza por completo el uso de `alert()` / `confirm()` / `prompt()` nativos.

### 6.1 Importación

**Solo en `<script>` de cliente** (nunca en frontmatter de Astro):

```ts
import { showError, showSuccess, showConfirm, showToast } from '@/utils/alerts';
```

Rutas relativas según ubicación del archivo:
- Desde `src/pages/*.astro` → `'../../utils/alerts.js'`
- Desde `src/components/*.astro` → `'../utils/alerts.js'`

### 6.2 API

| Función | Cuándo usar | Color del botón |
|---|---|---|
| `showError(title, text?, confirmText?)` | Validación de formulario, error de API | Rojo `#ef4444` |
| `showSuccess(title, text?, confirmText?)` | Operación completada, confirmación positiva | Verde `#a3e635` |
| `showConfirm({ title, text?, confirmText?, cancelText?, destructive?, icon? })` | Decisión crítica antes de acción irreversible | Fucsia `#d946ef` (normal) o rojo (destructivo) |
| `showToast(icon, title, timer?)` | Feedback efímero no bloqueante (operaciones exitosas o errores menores) | Según icono |

### 6.3 Convenciones

- **NO uses** `alert()` / `confirm()` / `prompt()` nativos. Rompen el Design System y bloquean el hilo principal.
- **NO importes** `sweetalert2` directamente. Siempre a través del wrapper.
- **Sí** usa `await` antes de cada llamada. Todas las funciones son asíncronas.
- **Sí** usá voseo argentino en los mensajes ("Revisá", "intentá", "completá").
- **Sí** usá `destructive: true` para acciones irreversibles (borrar, disolver, enviar comunicado masivo).
- **Sí** exportá las opciones como objeto para confirmaciones con lógica condicional.

### 6.4 Ejemplos

**Error genérico (formulario):**
```ts
import { showError } from '@/utils/alerts';

if (password.value !== confirm.value) {
  await showError('Las contraseñas no coinciden', 'Verificá que ambos campos tengan el mismo valor.');
  password.focus();
  return;
}
```

**Éxito (operación completada):**
```ts
import { showSuccess } from '@/utils/alerts';

await showSuccess('Enlace de recuperación enviado', 'Revisá tu bandeja de entrada.');
window.location.href = '/login';
```

**Confirmación destructiva:**
```ts
import { showConfirm } from '@/utils/alerts';

const ok = await showConfirm({
  title: '¿Enviar comunicado a 150 personas?',
  text: 'Esta acción no se puede deshacer y consumirá cuota de tu límite diario de Brevo.',
  confirmText: 'Sí, enviar',
  cancelText: 'Cancelar',
  destructive: true,
  icon: 'warning',
});
if (!ok) return;
```

**Toast efímero:**
```ts
import { showToast } from '@/utils/alerts';

showToast('success', 'Usuario aprobado correctamente', 2000);
```

### 6.5 Accesibilidad

El wrapper hereda las siguientes características de a11y de SweetAlert2:

- `role="dialog"` y `aria-modal="true"` automáticos.
- `aria-labelledby` y `aria-describedby` enlazados al título y contenido.
- Focus trap con `Tab` cycling.
- `Esc` cierra el modal.
- `Enter` activa el botón de confirmación.
- Restauración del foco al elemento que abrió el modal.

Para testing manual con lector de pantalla, ver `docs/audits/screen-reader-test-procedure.md`.

### 6.6 Shadowing de `showToast`

Algunos archivos (ej. `src/pages/admin/index.astro`, `src/components/TeamManager.astro`) tienen una función local `showToast()` que se usaba antes del wrapper. **NO renombres** la función local a `showToastDS` ni similares: en su lugar, **elimínala** y migrá todas las invocaciones al wrapper. La deuda técnica está documentada en `Alertas.md §9`.

Si necesitás invocar el wrapper desde un archivo que aún tiene la función local, usá el import con namespace:

```ts
import * as Alerts from '@/utils/alerts';
Alerts.showToast('success', 'Mensaje');
```

### 6.7 Auditorías

- **axe-core**: `node scripts/axe-audit.mjs` (requiere dev server corriendo).
- **Lighthouse a11y**: `npx lighthouse <url> --only-categories=accessibility --chrome-flags="--headless --no-sandbox"`.
- Reportes guardados en `docs/audits/axe-reports/` y `docs/audits/lighthouse-reports/`.

### 6.8 Anti-patrones

- ❌ Mezclar `alert()` nativos con `showError()` en el mismo archivo.
- ❌ Usar `showConfirm()` sin `await` (devuelve `Promise<boolean>`).
- ❌ Olvidar el foco tras cerrar un modal (ya lo hace Swal, pero si modificás el wrapper, mantenelo).
- ❌ Importar `sweetalert2` directo en un componente (rompe la centralización del tema).
- ❌ Crear un modal custom con `<div>` + clase `.show` cuando el wrapper alcanza.

---

*Documento creado para el proyecto HEM2026 — Hackathon EduTech Mendoza 2026*
