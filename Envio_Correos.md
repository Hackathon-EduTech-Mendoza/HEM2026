# 📧 Módulo de Comunicados — Envío Masivo de Correos vía Brevo

## Objetivo

Agregar una nueva pestaña **"Comunicados"** al Centro de Comando (`/admin`) para que los roles `admin` y `superadmin` puedan redactar y enviar correos masivos (boletines, novedades) a los usuarios registrados, utilizando la **API de Brevo** (plan gratuito: 300 emails/día).

---

## Arquitectura Propuesta

```
Admin (Browser)
     │
     ▼  POST /api/send-bulletin  {subject, message}
┌─────────────────────────────────┐
│   API Route de Astro (Vercel)   │
│   src/pages/api/send-bulletin.ts│
│                                 │
│  1. Verificar sesión (cookies)  │
│  2. Verificar rol (admin/super) │
│  3. Obtener emails de Supabase  │
│  4. Armar template HTML         │
│  5. Enviar vía Brevo API v3     │
│  6. Retornar resultado JSON     │
└────────┬───────────┬────────────┘
         │           │
         ▼           ▼
    Supabase      Brevo API
   (profiles)   (POST /v3/smtp/email)
```

### ¿Por qué API Route de Astro y NO Edge Function de Supabase?

| Criterio | API Route Astro | Edge Function Supabase |
|----------|-----------------|------------------------|
| Configuración | Ya funciona (`output: 'server'` + Vercel) | Requiere `config.toml` + CLI (no inicializado) |
| Secrets | Variables de entorno nativas en Vercel | Hay que configurar secrets en Supabase CLI |
| Auth | Reutiliza el middleware existente de cookies | Hay que reimplementar verificación de JWT |
| Deployment | Se deploya con el proyecto automáticamente | Requiere `supabase functions deploy` separado |
| Mantenimiento | Todo el código en un solo codebase | Código dividido entre Astro y Supabase |

**Conclusión:** API Route de Astro es más simple y consistente con la arquitectura actual.

---

## Límites de Brevo (Plan Gratuito)

| Restricción | Valor |
|-------------|-------|
| Emails por día | **300** |
| Emails por request (`messageVersions`) | **1,000** |
| Destinatarios por `messageVersion` | **99** |
| Total destinatarios por request | **2,000** |
| Branding | Incluye "Sent by Brevo" en el footer |

---

## Preguntas Abiertas (Requieren decisión del equipo)

- [ ] **¿Filtrar destinatarios por rol?** Opción A: enviar a TODOS los aprobados. Opción B: solo `usuario` (excluyendo mentores/jueces/admins). Opción C: permitir elegir roles desde la UI.
- [ ] **¿Guardar historial de envíos?** Si sí → nueva tabla `bulletins` en Supabase. Si no → fire-and-forget sin registro.
- [ ] **¿Editor de texto enriquecido?** Opción A: `<textarea>` simple (texto plano, el API lo envuelve en HTML con branding). Opción B: editor WYSIWYG (ej. TipTap) para negritas, links, etc. (más complejo).

---

## Variables de Entorno Necesarias

```env
# Brevo (Comunicados masivos) — SIN prefijo PUBLIC_, son privadas
BREVO_API_KEY=tu_api_key_de_brevo
BREVO_SENDER_EMAIL=hackathonedutech@gmail.com
BREVO_SENDER_NAME=Hackathon EduTech Mendoza
```

> ⚠️ **Configurar SOLO en Vercel (Production + Preview) y en `.env` local. NUNCA commitear.**

---

## Tareas Atómicas

### Fase 0 — Preparación

- [x] **0.1** Obtener la API Key de Brevo desde el panel de Brevo (`Settings > API Keys`).
- [x] **0.2** Configurar las 3 variables de entorno en el archivo `.env` local:
  - `BREVO_API_KEY`
  - `BREVO_SENDER_EMAIL`
  - `BREVO_SENDER_NAME`
- [x] **0.3** Configurar las mismas 3 variables en **Vercel** → Project Settings → Environment Variables (Production + Preview).
- [x] **0.4** Agregar las variables al archivo `.env.example` (sin valores reales, solo placeholders).

---

### Fase 1 — API Route (Backend)

- [x] **1.1** Crear el archivo `src/pages/api/send-bulletin.ts`.
- [x] **1.2** Implementar la verificación de método (`POST` only, rechazar con 405).
- [x] **1.3** Implementar la autenticación SSR:
  - Crear `createServerClient` con cookies del request.
  - Obtener el usuario con `getUser()`.
  - Obtener el perfil desde tabla `profiles`.
  - Verificar que `role === 'admin' || role === 'superadmin'` → si no, 403.
- [x] **1.4** Parsear y validar el body del request:
  - `subject` (string, obligatorio, max 150 caracteres).
  - `message` (string, obligatorio, max 5000 caracteres).
- [x] **1.5** Obtener los destinatarios desde Supabase:
  - `SELECT email, first_name FROM profiles WHERE registration_status = 'aprobado'`.
  - Filtrar emails nulos o vacíos.
- [x] **1.6** Construir el template HTML del email con el branding del evento:
  - Header con gradiente fucsia→violeta y nombre del evento.
  - Body con el contenido del mensaje.
  - Footer con link al sitio, texto de desuscripción, año.
  - Variable `{{ params.FNAME }}` para el nombre del destinatario.
- [x] **1.7** Dividir los destinatarios en lotes de 99 (límite de Brevo por `messageVersion`).
- [x] **1.8** Enviar cada lote a `POST https://api.brevo.com/v3/smtp/email`:
  - Header: `api-key: <BREVO_API_KEY>`, `Content-Type: application/json`.
  - Body con `sender`, `subject`, `htmlContent` y `messageVersions[]`.
- [x] **1.9** Manejar errores de Brevo (429 rate limit, 400 bad request, 500 server error).
- [x] **1.10** Retornar respuesta JSON al frontend:
  - Éxito: `{ success: true, recipientCount: N }`.
  - Error: `{ success: false, error: "mensaje descriptivo" }`.

---

### Fase 2 — UI Admin: Pestaña Comunicados (Frontend)

- [x] **2.1** Agregar el botón de pestaña "Comunicados" en `.admin-tabs-nav` (después de "Resultados").
- [x] **2.2** Crear el contenedor `<div class="tab-content" id="tab-comunicados">`.
- [x] **2.3** Agregar badge informativo: `📧 X destinatarios aprobados | Límite: 300/día`.
  - El valor `X` se calcula en el frontmatter a partir del array `profiles` ya cargado.
- [x] **2.4** Agregar el campo de asunto: `<input type="text" id="bulletin-subject" maxlength="150">`.
- [x] **2.5** Agregar el campo de mensaje: `<textarea id="bulletin-message" rows="8" maxlength="5000">`.
- [x] **2.6** Agregar contador de caracteres dinámico debajo del textarea.
- [x] **2.7** Agregar botón de envío: `<button id="send-bulletin-btn" class="btn btn-primary">Enviar Comunicado</button>`.
- [x] **2.8** Agregar sección colapsable de vista previa del email (opcional, mejora UX).

---

### Fase 3 — Lógica Client-Side (JavaScript)

- [x] **3.1** Agregar evento `click` al botón de envío con `confirm()` de confirmación.
- [x] **3.2** Implementar validación client-side: asunto y mensaje no vacíos.
- [x] **3.3** Implementar estado de carga: botón deshabilitado + spinner + texto "Enviando...".
- [x] **3.4** Hacer `fetch('/api/send-bulletin', { method: 'POST', body: JSON.stringify({...}) })`.
- [x] **3.5** Manejar respuesta exitosa: mostrar toast verde con `"✓ Comunicado enviado a X usuarios"`.
- [x] **3.6** Manejar respuesta de error: mostrar toast rojo con el mensaje de error.
- [x] **3.7** Restaurar estado del botón al finalizar (éxito o error).

---

### Fase 4 — Estilos CSS

- [x] **4.1** Estilizar el formulario de comunicados (ancho max 700px, centrado).
- [x] **4.2** Estilizar el badge de destinatarios (píldora con colores del theme).
- [x] **4.3** Estilizar los inputs con focus en fucsia (`--c1`).
- [x] **4.4** Estilizar el botón de envío (gradiente, hover, estado disabled/loading).
- [x] **4.5** Asegurar que la pestaña se ve correctamente en móvil (responsive).

---

### Fase 5 — Verificación

- [ ] **5.1** Ejecutar `npm run build` → sin errores de compilación.
- [ ] **5.2** Probar `GET /api/send-bulletin` → debe retornar 405.
- [ ] **5.3** Probar `POST /api/send-bulletin` sin sesión → debe retornar 403.
- [ ] **5.4** Probar `POST /api/send-bulletin` con usuario `usuario` → debe retornar 403.
- [ ] **5.5** Probar envío con asunto/mensaje vacíos → validación client-side y server-side.
- [ ] **5.6** Probar envío real con un destinatario de prueba → verificar recepción del email.
- [ ] **5.7** Verificar que el email recibido tiene el template correcto (branding, colores, responsive).
- [ ] **5.8** Verificar responsividad de la pestaña Comunicados en móvil.
- [ ] **5.9** Hacer commit con mensaje descriptivo.

---

## Archivos Involucrados

| Acción | Archivo | Descripción |
|--------|---------|-------------|
| **NUEVO** | `src/pages/api/send-bulletin.ts` | API Route server-side para envío vía Brevo |
| **MODIFICAR** | `src/pages/admin/index.astro` | Nueva pestaña "Comunicados" + JS + CSS |
| **MODIFICAR** | `.env.example` | Agregar placeholders de variables de Brevo |

---

## Diagrama de Flujo Detallado

```
┌─────────────────────────────────────────────────────┐
│                  ADMIN (Browser)                     │
│                                                      │
│  Pestaña "Comunicados" en /admin                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  📧 145 destinatarios | Límite: 300/día     │    │
│  │                                             │    │
│  │  Asunto: [________________________]         │    │
│  │                                             │    │
│  │  Mensaje:                                   │    │
│  │  ┌─────────────────────────────────────┐   │    │
│  │  │                                     │   │    │
│  │  │                                     │   │    │
│  │  └─────────────────────────────────────┘   │    │
│  │                          1234/5000 chars    │    │
│  │                                             │    │
│  │  [ 🚀 Enviar Comunicado ]                  │    │
│  └─────────────────────────────────────────────┘    │
└───────────────────────┬─────────────────────────────┘
                        │ POST /api/send-bulletin
                        ▼
┌─────────────────────────────────────────────────────┐
│              API Route (Vercel Serverless)            │
│                                                      │
│  1. ¿Método POST?           ── NO ──▶ 405           │
│  2. ¿Sesión válida?         ── NO ──▶ 401           │
│  3. ¿Rol admin/superadmin?  ── NO ──▶ 403           │
│  4. ¿Subject y message OK?  ── NO ──▶ 400           │
│  5. Consultar profiles (aprobados) ──▶ Supabase     │
│  6. Armar HTML con template de marca                 │
│  7. Dividir en lotes de 99                           │
│  8. Enviar cada lote ──▶ Brevo API                   │
│  9. Retornar { success, recipientCount }             │
└─────────────────────────────────────────────────────┘
```

---

## Notas Adicionales

- El template HTML del email debe ser **inline** (no un archivo separado) dentro del API Route, para simplicidad.
- Los párrafos del mensaje se separan con `\n` en el textarea y se convierten a `<p>` en el HTML.
- Si un lote falla en Brevo, se reporta el error pero los lotes anteriores ya enviados no se revierten (Brevo no tiene rollback).
- La pestaña de Comunicados solo se muestra si el usuario es `admin` o `superadmin` (ya protegido por el middleware y la verificación del frontmatter).
