# Plan Refactor Definitivo v4 V2 — HEM2026

Plan técnico y mapa de componentes para el refactor profundo de registro, reglas de equipo, mentores y contenido de la Landing page.

**V2:** Incorpora todas las decisiones tomadas en sesiones previas. Las preguntas abiertas del V1 están resueltas más abajo.

---

## Decisiones Resueltas (V1 → V2)

| # | Pregunta V1 | Decisión V2 |
|---|---|---|
| 1 | Cronograma — Sedes por jornada | Misma estructura 3 días (19 Ago virtual, 21-22 Ago presencial). Sedes: IES 9-023 y Auditorio Municipal Marciano Cantero reemplazan Le Parc y Edison |
| 2 | Noticias — Estáticas o dinámicas | **Estáticas** — array hardcodeado en componente, sin tabla Supabase |
| 3 | Redes sociales — URLs | **Placeholder** `@hackathonedutech` → actualizar cuando haya URL real |
| 4 | RPCs fuera de migraciones | **Recrear en migraciones** — fetch del cuerpo actual desde Supabase (`SELECT prosrc FROM pg_proc`) antes de reescribir |
| 5 | `full_name` split — Usuarios existentes | **Forzar re-ingreso en onboarding** — `first_name`/`last_name` arrancan NULL. Middleware redirige a `/onboarding` si ambos son NULL. No split automático. `full_name` se mantiene, trigger sincroniza: `full_name = first_name \|\| ' ' \|\| last_name` |

---

## Estado Actual (Auditoría Confirmada)

### Esquema de Base de Datos

| Tabla | Columnas clave | Notas |
|---|---|---|
| `profiles` | `id`, `full_name`, `email`, `role`, `institution`, `dni`, `phone_whatsapp`, `instagram_handle`, `year_of_study`, `disciplinary_profile`, `is_egresado`, `registration_status`, `team_id` | `registration_status` default = `'aprobado'` (migración `20260519`). `full_name` es un solo campo. **Sin** `first_name`, `last_name`, `professional_title` |
| `teams` | `id`, `name`, `join_code`, `leader_id`, `mentor_id` | Solo **1 mentor** por equipo. **Sin** `mentor_id_2` |
| `event_config` | `key`, `value`, `description` | **No existen** claves `max_egresados_per_team`, `max_tecnicos_per_team`, `max_docentes_per_team`. Límite egresados hardcodeado en RPCs |
| `help_requests` | `id`, `team_id`, `mentor_id`, `status`, timestamps | Sistema SOS completo. `help_enabled = 'false'` en event_config |

### Flujo de Registro Actual

```
Registro: full_name + email + password
  → Dashboard: completar perfil (DNI, institución, etc.)
    → registration_status = 'aprobado' automático (para TODOS los roles)
      → Acceso completo: equipo, mentoría, SOS
```

### Problemas Detectados

- No hay selección de rol durante el registro (solo admin lo asigna)
- `full_name` es un solo campo (se necesita separar en Nombres + Apellidos)
- Auto-aprobación se aplica a TODOS los roles, incluyendo juez y mentor
- El banner "¡Inscripción confirmada!" se muestra siempre, incluso para `rechazado`
- No existe UI de "En revisión" para roles pendientes
- No existe archivo `onboarding.astro`
- Middleware no maneja `/onboarding` ni detecta perfil incompleto
- `env.d.ts` UserProfile no tiene `first_name`, `last_name`, `professional_title`

### Landing Page Actual

- Sedes hardcodeadas: "Espacio Cultural Julio Le Parc" y "IES Tomás Alva Edison" en InfoCards, Schedule, JSON-LD
- No existe sección de Noticias/Avisos
- No existen enlaces a redes sociales en Footer
- Footer.astro sin íconos sociales

---

## Área 1: Landing Page y Contenido

### 1.1 — Actualizar Sedes

**Sedes nuevas:**
- "IES 9-023" reemplaza "IES Tomás Alva Edison"
- "Auditorio Municipal Marciano Cantero" reemplaza "Espacio Cultural Julio Le Parc"

**Estructura cronograma:**
- 19 Ago: Jornada virtual (sin cambio de sede)
- 21 Ago: Presencial — IES 9-023
- 22 Ago: Presencial — Auditorio Municipal Marciano Cantero

#### [MODIFY] InfoCards.astro
- Reemplazar "IES Tomás Alva Edison" → **"IES 9-023"**
- Reemplazar "Espacio Cultural Julio Le Parc" → **"Auditorio Municipal Marciano Cantero"**
- Texto card Sedes: "Instituto de Educación Superior 9-023 y Auditorio Municipal de Maipú, Marciano Cantero. Dos jornadas presenciales de trabajo intensivo."

#### [MODIFY] Schedule.astro
- Reemplazar todas las referencias a "Espacio Cultural Julio Le Parc" → **"Auditorio Municipal Marciano Cantero"**
- Reemplazar "IES Tomás Alva Edison" / "Escuela Tomas Alva Edison" → **"IES 9-023"**
- Actualizar dirección hardcodeada (línea 113)
- Día 2 (21 Ago): IES 9-023
- Día 3 (22 Ago): Auditorio Municipal Marciano Cantero

#### [MODIFY] index.astro (Landing)
- Actualizar bloque JSON-LD: reemplazar los 2 objetos `location` con sedes correctas y direcciones

---

### 1.2 — Nueva Sección: Noticias/Avisos (Estáticas)

#### [NEW] NewsSection.astro

**Ubicación:** Entre `<Prizes />` y `<Schedule />` en index.astro.

**Decisión:** Noticias estáticas — array hardcodeado en el componente.

**Diseño:**
- PC: Grid/cards con aside visual
- Móvil: Cards apiladas o carrusel horizontal
- Cada card: icono tipo, título, extracto (2 líneas), fecha
- Datos hardcoded en constante `NOTICIAS` dentro del componente

**Estructura de datos:**
```js
const NOTICIAS = [
  {
    tipo: 'aviso',
    titulo: 'Inscripciones abiertas',
    extracto: 'Ya podés inscribirte a la Hackathon EduTech Mendoza 2026.',
    fecha: '2026-06-01'
  },
  // ... más noticias
];
```

#### [MODIFY] index.astro (Landing)
- Importar y renderizar `<NewsSection />` entre `<Prizes />` y `<Schedule />`

---

### 1.3 — Enlaces a Redes Sociales

#### [MODIFY] Footer.astro
- Agregar fila de íconos sociales SVG inline en la sección de marca
- Instagram: placeholder `https://instagram.com/hackathonedutech` (actualizar después)
- Usar íconos SVG inline (no dependencias externas)
- Respetar variables CSS del design system (`--c-accent`, etc.)

---

## Área 2: Flujo de Registro Dinámico

### 2.1 — Migración SQL: Ampliar `profiles`

```sql
-- Migración: 20260522_01_profiles_names_refactor.sql

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS professional_title TEXT;

-- NO hacer split automático de full_name existente.
-- Los usuarios existentes serán redirigidos a /onboarding
-- donde ingresarán first_name y last_name manualmente.
-- first_name y last_name arrancan NULL para todos.

-- Revertir default de registration_status a 'pendiente'
ALTER TABLE public.profiles
ALTER COLUMN registration_status SET DEFAULT 'pendiente'::registration_status;

-- Trigger: sincronizar full_name desde first_name + last_name
-- (para compatibilidad con vistas y RPCs existentes)
CREATE OR REPLACE FUNCTION public.sync_full_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL THEN
    NEW.full_name := NEW.first_name || ' ' || NEW.last_name;
  ELSIF NEW.first_name IS NOT NULL THEN
    NEW.full_name := NEW.first_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_full_name ON public.profiles;
CREATE TRIGGER trg_sync_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_full_name();
```

> **Nota:** `full_name` se mantiene por compatibilidad con `handle_new_user()`, vistas (`mentor_help_stats`, `project_leaderboard`) y RPCs. El trigger `sync_full_name` lo mantiene sincronizado automáticamente.

### 2.2 — Trigger de Auto-Aprobación Condicional

```sql
-- Migración: 20260522_02_auto_approve_trigger.sql

-- Eliminar trigger anterior de auto-aprobación universal
DROP TRIGGER IF EXISTS trg_auto_approve ON public.profiles;
DROP FUNCTION IF EXISTS public.auto_approve_participant();

-- Nuevo trigger: solo auto-aprobar participantes (rol 'usuario')
-- Jueces y mentores quedan como 'pendiente' para revisión admin
CREATE OR REPLACE FUNCTION public.auto_approve_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'usuario'
     AND NEW.dni IS NOT NULL
     AND NEW.institution IS NOT NULL
  THEN
    NEW.registration_status := 'aprobado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_approve ON public.profiles;
CREATE TRIGGER trg_auto_approve
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_participant();
```

> **Importante:** Este trigger corre DESPUÉS de `trg_sync_full_name` (orden alfabético de nombre). El trigger de auto-aprobación no depende de `full_name`, sino de `role`, `dni`, `institution`.

### 2.3 — Update del trigger `handle_new_user`

```sql
-- Incluir en migración 20260522_01_profiles_names_refactor.sql

-- El trigger handle_new_user (AFTER INSERT auth.users) crea profile
-- con full_name desde metadata. Actualizar para manejar:
-- - Si el usuario se registra sin full_name → full_name = NULL
-- - first_name y last_name empiezan NULL
-- - El usuario completará estos campos en /onboarding

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, registration_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'usuario'),
    'pendiente'
  );
  RETURN NEW;
END;
$$;
```

> **Cambio clave:** `registration_status` default explícito `'pendiente'`. `full_name` puede ser string vacío si no hay metadata. El usuario completará `first_name`/`last_name` en onboarding, y el trigger `sync_full_name` actualizará `full_name` automáticamente.

### 2.4 — Nuevo Flujo de Registro (Frontend)

```
registro.astro: Email + Password
  → Cuenta creada en Supabase Auth
    → handle_new_user crea profile con registration_status='pendiente'
      → Redirect → /onboarding
        → Paso 1: ¿Cuál es tu rol? (Participante / Juez / Mentor)
          → Paso 2: Formulario dinámico según rol
            → profiles.update() con todos los campos
              → Trigger auto_approve_participant:
                - Si role='usuario' + datos completos → 'aprobado' → /dashboard
                - Si role='juez' o 'mentor' → 'pendiente' → /dashboard (UI revisión)
```

#### [MODIFY] registro.astro
- Eliminar campo `full_name` del formulario
- Mantener solo: email + password
- Post-signup redirect: `/dashboard` → `/onboarding`
- En metadata de signup: ya NO enviar `full_name`

#### [NEW] onboarding.astro
- **Paso 1 — Selección de Rol:** 3 cards grandes (Participante, Juez, Mentor) con íconos y descripción breve
- **Paso 2 — Formulario Dinámico según rol:**

**Formulario Participante (`rol = 'usuario'`):**

| Campo | Tipo | Validación |
|---|---|---|
| Nombres (según DNI) | text | Requerido → `first_name` |
| Apellidos (según DNI) | text | Requerido → `last_name` |
| DNI | text | Requerido, numérico, 7-8 dígitos |
| Correo | email | Pre-rellenado desde auth, readonly |
| WhatsApp | tel | Requerido, formato argentino |
| Instagram | text | Opcional |
| Institución | select | `ies_9023_maipu`, `ies_edison`, `otra` |
| Año Cursado | select | `1°`, `2°`, `3°`, `Profesional`, `Otro` |
| Título Profesional | text | Visible solo si Año = `Profesional` → `professional_title` |
| Perfil Disciplinar | select | `Formación Docente`, `Formación Técnica`, `Otro` |
| ¿Sos egresado/a? | checkbox | → `is_egresado` |

**Formulario Juez (`rol = 'juez'`):**

| Campo | Tipo |
|---|---|
| Nombres | text → `first_name` |
| Apellidos | text → `last_name` |
| DNI | text |
| WhatsApp | tel |
| Institución | select |
| Perfil Disciplinar | select |

**Formulario Mentor (`rol = 'mentor'`):**

| Campo | Tipo |
|---|---|
| Nombres | text → `first_name` |
| Apellidos | text → `last_name` |
| DNI | text |
| WhatsApp | tel |
| Instagram | text |
| Institución | select |
| Perfil Disciplinar | select |

- **Submit:** `supabase.from('profiles').update({ first_name, last_name, role, dni, ... })`
- El trigger `auto_approve_participant` se encarga del `registration_status`
- El trigger `sync_full_name` sincroniza `full_name` automáticamente
- Post-submit: redirect a `/dashboard`

#### [MODIFY] middleware.ts
- Agregar `/onboarding` a las rutas protegidas (requiere auth)
- Si el usuario ya completó el perfil (`first_name IS NOT NULL AND last_name IS NOT NULL`), redirigir de `/onboarding` al panel correspondiente según rol
- Si el usuario no tiene perfil completo (`first_name IS NULL OR last_name IS NULL`) y accede a `/dashboard` o cualquier panel, redirigir a `/onboarding`
- Eximir `/onboarding` del redirect de perfil incompleto (para evitar loop)

#### [MODIFY] env.d.ts
- Agregar al `UserProfile`:
```typescript
first_name: string | null;
last_name: string | null;
professional_title: string | null;
```

---

## Área 3: Reglas Dinámicas de Equipo

### 3.1 — Migración SQL: Nuevas claves en `event_config`

```sql
-- Migración: 20260522_03_team_composition_limits.sql

INSERT INTO public.event_config (key, value, description) VALUES
('max_egresados_per_team', '1', 'Máximo de egresados por equipo'),
('max_tecnicos_per_team', '2', 'Máximo de miembros con perfil técnico por equipo'),
('max_docentes_per_team', '2', 'Máximo de miembros con perfil docente por equipo')
ON CONFLICT (key) DO NOTHING;
```

### 3.2 — Refactor RPCs de Equipo

> **Riesgo:** Las funciones `create_team`, `join_team`, `leave_team` fueron creadas directamente en Supabase Dashboard. No están en migraciones. Para recrearlas, se debe hacer backup del cuerpo actual con `SELECT prosrc FROM pg_proc WHERE proname = 'join_team'` antes de reescribir.

**Estrategia:**
1. Fetch del cuerpo actual de cada RPC desde Supabase (vía MCP o SQL Editor)
2. Escribir migración `20260522_05_join_team_refactor.sql` con las funciones actualizadas
3. Aplicar migración — `CREATE OR REPLACE` no pierde datos si se hace correctamente

**Nuevo `join_team` — Cambios vs actual:**
- Leer límites desde `event_config` en vez de hardcodear
- Validar `disciplinary_profile` del usuario que intenta unirse
- Validar `is_egresado` contra `max_egresados_per_team`
- Validar `disciplinary_profile = 'tecnico'` contra `max_tecnicos_per_team`
- Validar `disciplinary_profile = 'docente'` contra `max_docentes_per_team`
- Strings de error en español

```sql
-- Pseudocódigo del nuevo join_team:

CREATE OR REPLACE FUNCTION public.join_team(p_join_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_team_id UUID;
  v_current_size INT;
  v_max_size INT;
  v_max_egresados INT;
  v_max_tecnicos INT;
  v_max_docentes INT;
  v_count_egresados INT;
  v_count_tecnicos INT;
  v_count_docentes INT;
  v_user_profile RECORD;
BEGIN
  -- ... validaciones existentes (auth, equipo existe, no tiene equipo, etc.)

  -- Leer límites desde event_config
  SELECT value::INT INTO v_max_egresados FROM event_config WHERE key = 'max_egresados_per_team';
  SELECT value::INT INTO v_max_tecnicos FROM event_config WHERE key = 'max_tecnicos_per_team';
  SELECT value::INT INTO v_max_docentes FROM event_config WHERE key = 'max_docentes_per_team';

  -- Obtener perfil del usuario que intenta unirse
  SELECT * INTO v_user_profile FROM profiles WHERE id = auth.uid();

  -- Contar miembros actuales por categoría
  SELECT
    COUNT(*) FILTER (WHERE is_egresado = true),
    COUNT(*) FILTER (WHERE disciplinary_profile = 'tecnico'),
    COUNT(*) FILTER (WHERE disciplinary_profile = 'docente')
  INTO v_count_egresados, v_count_tecnicos, v_count_docentes
  FROM profiles WHERE team_id = v_team_id;

  -- Validar límites
  IF v_user_profile.is_egresado AND v_count_egresados >= v_max_egresados THEN
    RETURN json_build_object('ok', false, 'error',
      'El equipo ya alcanzó el máximo de egresados (' || v_max_egresados || ').');
  END IF;

  IF v_user_profile.disciplinary_profile = 'tecnico' AND v_count_tecnicos >= v_max_tecnicos THEN
    RETURN json_build_object('ok', false, 'error',
      'El equipo ya alcanzó el máximo de perfiles técnicos (' || v_max_tecnicos || ').');
  END IF;

  IF v_user_profile.disciplinary_profile = 'docente' AND v_count_docentes >= v_max_docentes THEN
    RETURN json_build_object('ok', false, 'error',
      'El equipo ya alcanzó el máximo de perfiles docentes (' || v_max_docentes || ').');
  END IF;

  -- ... continúa con la lógica de unión existente
END;
$$;
```

### 3.3 — UI: Nuevos Controles en Admin Panel

#### [MODIFY] admin/index.astro
- En la pestaña "Configuración": agregar 3 inputs numéricos:
  - "Máx. egresados por equipo" (`max_egresados_per_team`, min 0, max 5)
  - "Máx. técnicos por equipo" (`max_tecnicos_per_team`, min 0, max 5)
  - "Máx. docentes por equipo" (`max_docentes_per_team`, min 0, max 5)

---

## Área 4: Asignación Manual de Mentores

### 4.1 — Migración SQL: Soporte para 2 Mentores por Equipo

```sql
-- Migración: 20260522_04_dual_mentor_support.sql

-- Agregar segundo campo de mentor (NO renombrar mentor_id para no romper vistas/RPCs)
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS mentor_id_2 UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Actualizar vista mentor_help_stats para incluir ambos mentores
CREATE OR REPLACE VIEW public.mentor_help_stats AS
SELECT
  p.id AS mentor_id,
  p.full_name AS mentor_name,
  COUNT(hr.id) AS total_tickets,
  COUNT(hr.id) FILTER (WHERE hr.status = 'pendiente') AS pending_count,
  COUNT(hr.id) FILTER (WHERE hr.status = 'en_camino') AS in_progress_count,
  COUNT(hr.id) FILTER (WHERE hr.status = 'finalizado') AS finished_count,
  COUNT(hr.id) FILTER (WHERE hr.status = 'expirado') AS expired_count,
  COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (hr.started_at - hr.created_at)) / 60) FILTER (WHERE hr.started_at IS NOT NULL), 1), 0) AS avg_response_minutes,
  COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (hr.finished_at - hr.started_at)) / 60) FILTER (WHERE hr.finished_at IS NOT NULL AND hr.started_at IS NOT NULL), 1), 0) AS avg_session_minutes,
  (SELECT COUNT(*) FROM teams t WHERE t.mentor_id = p.id OR t.mentor_id_2 = p.id) AS assigned_teams
FROM public.profiles p
LEFT JOIN public.help_requests hr ON hr.mentor_id = p.id
WHERE p.role = 'mentor' AND p.registration_status = 'aprobado'
GROUP BY p.id, p.full_name;
```

> **Diseño:** `mentor_id` (principal, ej: técnico) + `mentor_id_2` (secundario, ej: pedagógico). Con exactamente 2 slots, columna extra > tabla intermedia.

### 4.2 — UI: Asignación Manual en Admin Panel

#### [MODIFY] admin/index.astro
- En la pestaña "Mentoría", rediseñar para incluir:
  - **Tabla de equipos** con columnas: Nombre, Mentor 1 (dropdown), Mentor 2 (dropdown), Miembros
  - Cada dropdown lista mentores aprobados (`role = 'mentor' AND registration_status = 'aprobado'`)
  - Botón "Guardar Asignaciones" → `supabase.from('teams').update({ mentor_id, mentor_id_2 })`
  - Mantener "Asignar Aleatoriamente" como opción secundaria (solo asigna `mentor_id`)

### 4.3 — Desactivar Sistema SOS Temporalmente

#### [MODIFY] dashboard/index.astro
- **Ocultar la pestaña "SOS"** del tabbed interface cuando `help_enabled = 'false'`
- No renderizar el tab ni su contenido si la config está deshabilitada
- Backend (`request_help` RPC) ya valida `help_enabled` → sin cambios server-side
- **No eliminar código** — solo ocultar. Reactivar con `help_enabled = 'true'` desde admin.

---

## Área 5: Refactor UX/UI del Dashboard

### 5.1 — Welcome Card para Participantes Aprobados

#### [MODIFY] dashboard/index.astro

**Eliminar** (~líneas 198-210):
- Ícono gigante de checkmark verde
- Título "¡Inscripción confirmada!"
- Badge de estado raw (`status-badge status-aprobado`)

**Reemplazar con "Welcome Card":**

```
┌─────────────────────────────────────────────────────┐
│ ¡Hola, {first_name}!                                │
│                                                      │
│ Bienvenido/a a la Hackathon EduTech Mendoza 2026.  │
│ Tu inscripción está confirmada.                      │
│                                                      │
│ Leé las FAQ para estar preparado/a                   │
│ Revisá las Bases y Condiciones                       │
│ Consultá el Cronograma                               │
│                                                      │
│ ───────────────────────────────────                  │
│ Editar datos personales →                            │
└─────────────────────────────────────────────────────┘
```

- Links de FAQ, Bases y Cronograma → secciones de la Landing
- "Editar datos personales" expande colapsable con campos de contacto (WhatsApp, Instagram) — plano secundario
- Usar `first_name` en vez de `full_name` para el saludo

### 5.2 — UI de "En Revisión" para Jueces/Mentores Pendientes

#### [MODIFY] dashboard/index.astro

Cuando `role IN ('juez', 'mentor') AND registration_status = 'pendiente'`:

```
┌─────────────────────────────────────────────────────┐
│ Tu solicitud está en revisión                        │
│                                                      │
│ El equipo organizador está revisando tu perfil      │
│ como {Juez/Mentor}. Te notificaremos cuando         │
│ tu registro sea aprobado.                            │
│                                                      │
│ Si tenés dudas, escribinos a:                        │
│ hackathonedutech@gmail.com                           │
└─────────────────────────────────────────────────────┘
```

- No mostrar pestañas de Equipo/Mentoría/SOS
- Solo card informativa + datos de contacto organizador

### 5.3 — CSS: Clase `status-pendiente`

```css
.status-pendiente {
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.3);
}
```

### 5.4 — TeamManager: Mostrar ambos mentores

#### [MODIFY] TeamManager.astro
- Mostrar `disciplinary_profile` badges de cada miembro
- Usar `first_name` en vez de `full_name` para display de miembros
- Mostrar ambos mentores asignados (Mentor 1 + Mentor 2) con sus perfiles disciplinares

---

## Mapa de Componentes Afectados

| Componente | Área | Cambio |
|---|---|---|
| InfoCards.astro | 1.1 | Texto de sedes |
| Schedule.astro | 1.1 | Nombres de sedes en cronograma |
| index.astro (Landing) | 1.1, 1.2 | JSON-LD + integrar `<NewsSection />` |
| **[NEW]** NewsSection.astro | 1.2 | Sección de noticias/avisos estáticas |
| Footer.astro | 1.3 | Íconos de redes sociales |
| registro.astro | 2.4 | Eliminar full_name, redirect a `/onboarding` |
| **[NEW]** onboarding.astro | 2.4 | Selección de rol + formulario dinámico |
| middleware.ts | 2.4 | Proteger `/onboarding`, redirigir si perfil incompleto |
| env.d.ts | 2.4 | Nuevos campos en `UserProfile` |
| admin/index.astro | 3.3, 4.2 | Controles composición equipo + UI asignación manual mentores |
| dashboard/index.astro | 4.3, 5.1, 5.2 | Welcome Card + UI revisión + ocultar SOS |
| TeamManager.astro | 5.4 | Mostrar `disciplinary_profile` badges, `first_name`, ambos mentores |
| mentoria.astro | 4.1 | Referenciar `mentor_id_2` en queries de equipos asignados |

---

## Migraciones SQL (Resumen Ordenado)

| # | Archivo | Descripción |
|---|---|---|
| 1 | `20260522_01_profiles_names_refactor.sql` | `first_name`, `last_name`, `professional_title` en profiles. Trigger `sync_full_name`. Revertir default `registration_status` a `'pendiente'`. Update `handle_new_user()`. |
| 2 | `20260522_02_auto_approve_trigger.sql` | Trigger `auto_approve_participant` que solo auto-aprueba `role = 'usuario'` con datos completos. |
| 3 | `20260522_03_team_composition_limits.sql` | Nuevas claves en `event_config`: `max_egresados_per_team` (1), `max_tecnicos_per_team` (2), `max_docentes_per_team` (2). |
| 4 | `20260522_04_dual_mentor_support.sql` | `mentor_id_2` en `teams`. Actualizar vista `mentor_help_stats`. |
| 5 | `20260522_05_join_team_refactor.sql` | Recrear RPCs `create_team`, `join_team`, `leave_team` en migraciones (actualmente fuera de VCS). Integrar validaciones de composición por perfil disciplinar. Leer límites desde `event_config`. |

---

## Plan de Verificación

### Build
```bash
npm run build
```

### Migraciones
- Verificar que las 5 migraciones se aplican sin errores (vía Supabase MCP o SQL Editor)
- Verificar que el trigger `sync_full_name` actualiza `full_name` correctamente
- Verificar que `auto_approve_participant` solo aprueba `role='usuario'`

### Tests Manuales
1. **Landing:** Sedes correctas en InfoCards, Schedule y JSON-LD
2. **Registro → Onboarding:** Crear cuenta nueva → verificar redirect a `/onboarding` → seleccionar rol → completar formulario → redirect a dashboard
3. **Auto-aprobación:** Participante con datos completos → `'aprobado'`. Juez/Mentor → `'pendiente'`
4. **Dashboard:** Welcome Card para aprobados. UI "En revisión" para pendientes
5. **Admin → Mentores:** Asignar manualmente 2 mentores a un equipo
6. **Admin → Config:** Editar límites de composición de equipo
7. **Equipos:** Intentar unir un 3er técnico cuando `max_tecnicos_per_team = 2` → rechazo con error en español
8. **SOS:** Tab oculto cuando `help_enabled = 'false'`
9. **Usuarios existentes:** Acceder a `/dashboard` → redirect a `/onboarding` (porque `first_name`/`last_name` son NULL)

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| Al recrear RPCs en migraciones, se pierde el cuerpo actual | Hacer `SELECT prosrc FROM pg_proc WHERE proname IN ('create_team','join_team','leave_team')` antes de aplicar migración 5 |
| `handle_new_user` trigger puede interferir con `sync_full_name` | `handle_new_user` hace INSERT con `full_name` desde metadata → `sync_full_name` no se dispara si `first_name`/`last_name` no están en el INSERT. Se dispara solo cuando el usuario los completa en onboarding |
| Trigger `auto_approve_participant` corre después de `sync_full_name` | No hay dependencia entre ellos. `auto_approve` solo usa `role`, `dni`, `institution` |
| Usuarios existentes con `full_name` pero sin `first_name`/`last_name` | Middleware redirige a `/onboarding` donde completan los campos manualmente. `full_name` se sobreescribe via `sync_full_name` |
| `mentor_id_2` rompe queries existentes en mentoria.astro | Actualizar queries de mentoria.astro para incluir `OR mentor_id_2 = p.id` |
