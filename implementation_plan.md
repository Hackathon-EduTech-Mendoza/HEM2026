# Plan de Implementación: Auditoría y Ajustes de Mentoría / Recursos (HEM2026)

Este plan detalla el diagnóstico y la solución al problema de visibilidad del Panel del Mentor (descubierto tras auditar las columnas de base de datos), la simplificación de las métricas del administrador sin tickets y el reemplazo de la pestaña de mentoría por recursos para los participantes.

---

## 1. Diagnóstico del Problema de Visibilidad del Mentor (Auditoría de Columnas)

### Qué está sucediendo
El mentor logueado como `mentor@gmail.com` ve **0 equipos asignados** en su panel `/mentoria`, a pesar de estar correctamente asignado en la base de datos.

Tras simular la consulta SQL como el usuario mentor vía MCP, validamos que las políticas RLS funcionan y retornan la fila correcta. Sin embargo, al inspeccionar el esquema de columnas de la tabla `projects` en la base de datos remota (`cotwhywqcocutrkmrpiw`), detectamos una discrepancia de nombres:
- **Nombres reales en base de datos**: `url_prototype` y `url_support_material`.
- **Nombres solicitados en la query de Astro (`mentoria.astro`)**: `prototype_url` y `support_url`.

Esta discrepancia provocaba que PostgREST fallara con un error `400 Bad Request` silencioso (ya que el código maneja `assignedTeamsData || []`), retornando `null` y simulando que el mentor no tiene ningún equipo asignado.

### Propuesta de Solución
1. Corregir las columnas en el SELECT de `projects` en `src/pages/mentoria.astro` a `url_prototype` y `url_support_material`.
2. Corregir las referencias del renderizado en el HTML de la tarjeta de proyecto en `src/pages/mentoria.astro`.
3. Adicionalmente, permitir que los administradores/superadministradores vean todos los equipos de la Hackathon (bypass de filtro) para facilitar la supervisión del evento y las pruebas en local.

---

## 2. Cambios Propuestos

### Componente: Panel del Mentor

#### [MODIFY] [mentoria.astro](file:///c:/Repositorios_Locales/Proyectos_Personales/HEM2026/src/pages/mentoria.astro)
- Modificar el query de Supabase para ajustar los nombres de columnas y el bypass de rol:
  ```javascript
  let query = supabase
    .from('teams')
    .select(`
      id,
      name,
      join_code,
      leader_id,
      mentor_id,
      mentor_id_2,
      profiles:profiles!team_id (
        id,
        full_name,
        disciplinary_profile,
        is_egresado
      ),
      projects (
        id,
        title,
        description_problem,
        description_solution,
        url_prototype,
        url_support_material
      )
    `);

  // Los mentores ven solo sus equipos; los administradores ven todos
  if (profile?.role === 'mentor') {
    query = query.or(`mentor_id.eq.${user.id},mentor_id_2.eq.${user.id}`);
  }

  const { data: assignedTeamsData, error: teamsError } = await query.order('name', { ascending: true });
  ```
- Ajustar las variables correspondientes en el renderizado HTML: `project.url_prototype` y `project.url_support_material`.

---

### Componente: Panel de Administración (Métricas de Mentoría)

#### [MODIFY] [index.astro (Admin)](file:///c:/Repositorios_Locales/Proyectos_Personales/HEM2026/src/pages/admin/index.astro)
Reformular la pestaña "Mentoría" para adecuarla a la ausencia de tickets:
- **Eliminar columnas obsoletas de tickets**: `Tickets`, `Pend.`, `En Camino`, `Final.`, `Expir.`, `Prom. Rta.`, `Prom. Sesión`.
- **Simplificar la tabla de métricas** para mostrar una lista útil de Mentores con:
  - Nombre completo.
  - Rol Disciplinar (Técnico / Pedagógico / Otro).
  - Datos de contacto y validación: DNI, Institución y Email (con enlace `mailto:` de contacto rápido).
  - Equipos asignados a su cargo (Slot 1 y Slot 2).

---

### Componente: Dashboard del Participante (Sección Recursos)

#### [MODIFY] [index.astro (Dashboard)](file:///c:/Repositorios_Locales/Proyectos_Personales/HEM2026/src/pages/dashboard/index.astro)
- Reemplazar la pestaña redundante de "Mentoría" (`data-tab="mentoria"`) por una pestaña de **"Recursos"** (`data-tab="recursos"`).
- Diseñar la vista en `tab-recursos` como un **Toolkit del Competidor** (Caja de Herramientas EduTech):
  - **Diseño & UX/UI**: Figma, Penpot.
  - **Código & Integración**: Astro Docs, Vercel, Supabase Docs.
  - **Plataformas No-Code**: Glide, Bubble.
  - **Materiales del Evento**: Plantilla de Pitch oficial, Bases del Evento.

---

## 3. Plan de Verificación

### Pruebas Automatizadas
- Ejecutar `cmd.exe /c npm run build` para asegurar la compilación limpia de todos los módulos modificados.

### Verificación Manual
1. Iniciar sesión como mentor (`mentor@gmail.com`) y validar que ahora se liste el equipo `LosInovadores` con sus participantes y datos del proyecto.
2. Iniciar sesión como superadmin/admin y verificar que se listen todos los equipos de la Hackathon.
3. Comprobar que en el Dashboard de participantes se muestre la pestaña de "Recursos" con el Toolkit.
4. Comprobar que en el panel administrativo la pestaña "Mentoría" se muestre simplificada y libre de columnas de tickets inactivos.
