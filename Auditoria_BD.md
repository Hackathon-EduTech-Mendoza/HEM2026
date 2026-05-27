# Auditoría de Base de Datos - Supabase (HEM 2026)
**ID de Proyecto:** cotwhywqcocutrkmrpiw
**Fecha:** 27/05/2026

## 1. Seguridad y Privacidad

### 1.1 Vistas con SECURITY DEFINER
Se detectaron vistas creadas con `SECURITY DEFINER`, lo que significa que se ejecutan con los permisos del creador de la vista y pueden saltarse las políticas RLS del usuario que las consulta:
- `public.mentor_help_stats`
- `public.project_leaderboard`

**Sugerencia:**
Recrear las vistas utilizando `SECURITY INVOKER` (disponible a partir de PostgreSQL 15) o asegurar que apliquen los filtros correctamente dentro de su lógica si el objetivo era justamente evadir RLS de forma controlada.
```sql
ALTER VIEW public.mentor_help_stats SET (security_invoker = on);
ALTER VIEW public.project_leaderboard SET (security_invoker = on);
```

### 1.2 Funciones expuestas a `anon` con SECURITY DEFINER
Muchas funciones que realizan operaciones sensibles (ej. `create_team`, `assign_mentors_randomly`) son `SECURITY DEFINER` y pueden ser ejecutadas por usuarios anónimos o cualquier rol (`public`). 

**Sugerencia:**
Revocar permisos de ejecución a `anon` y `public` y asignar sólo a los roles que correspondan, o cambiar la función a `SECURITY INVOKER`.
```sql
-- Ejemplo de remediación para las funciones expuestas:
REVOKE EXECUTE ON FUNCTION public.create_team(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_team(text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_team(text) TO authenticated;

-- Hacer esto con: assign_mentors_randomly, auto_approve_participant, get_my_team_id, join_team, leave_team, mentor_update_ticket, request_help, sync_full_name.
```

### 1.3 `search_path` no establecido en funciones
La función `public.handle_updated_at` tiene un `search_path` mutable. Esto es un riesgo de seguridad en funciones `SECURITY DEFINER`.

**Sugerencia:**
```sql
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
```

### 1.4 Protección de Contraseñas Filtradas
Supabase Auth no tiene activada la protección contra contraseñas filtradas (HaveIBeenPwned). 

**Sugerencia:**
Activar desde el panel de Supabase Auth en la sección de seguridad.

---

## 2. Performance (Rendimiento)

### 2.1 Índices faltantes en Foráneas (Foreign Keys)
Varios constraints de clave foránea no tienen índices correspondientes, lo cual penaliza las operaciones de JOIN, UPDATE y DELETE.

**Sugerencia:**
```sql
CREATE INDEX idx_evaluations_judge_id ON public.evaluations(judge_id);
CREATE INDEX idx_teams_leader_id ON public.teams(leader_id);
CREATE INDEX idx_teams_mentor_id_2 ON public.teams(mentor_id_2);
CREATE INDEX idx_teams_mentor_id ON public.teams(mentor_id);
```

### 2.2 Índices no utilizados
El advisor reportó que algunos índices no están siendo utilizados por las consultas:
- `idx_edition_projects_edition_id` en `public.edition_projects`
- `idx_editions_year` en `public.editions`

**Sugerencia:**
Monitorear o eliminar si se corrobora que no se utilizan:
```sql
DROP INDEX IF EXISTS public.idx_edition_projects_edition_id;
DROP INDEX IF EXISTS public.idx_editions_year;
```

### 2.3 Problemas de "Auth RLS Initialization Plan" (Evaluación fila por fila)
Las políticas RLS que hacen llamadas directas a funciones como `auth.uid()` o subconsultas que invocan esta función causan que la función se evalúe por cada fila, degradando enormemente el rendimiento en consultas masivas. 

**Ejemplos detectados:**
En tablas `help_requests`, `teams`, y `evaluations`.
```sql
-- Política actual (Mala performance):
(team_id = (SELECT profiles.team_id FROM profiles WHERE (profiles.id = auth.uid())))

-- Política sugerida (Usa '(select auth.uid())' como parámetro estático en la query)
(team_id = (SELECT profiles.team_id FROM profiles WHERE profiles.id = (SELECT auth.uid())))
```

**Sugerencia de Reescritura General:**
Revisar las políticas afectadas e incorporar el tip de encapsular `auth.uid()` en un `SELECT` para habilitar un InitPlan:
```sql
-- Ejemplo en help_requests (mentors_read_assigned_help_requests)
ALTER POLICY "mentors_read_assigned_help_requests" ON public.help_requests 
USING (
  mentor_id = (select auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND profiles.role = 'mentor'::user_role
  )
);
```

### 2.4 Multiplicidad de Políticas Permisivas
Supabase Advisor advirtió que hay múltiples políticas permisivas para la misma acción. Por ejemplo, en casi todas las tablas hay una política separada para `admin` y `superadmin`. Al evaluar una tabla, PostgreSQL verificará ambas, aumentando los tiempos.

**Sugerencia:**
Consolidar políticas utilizando `IN` o `ANY`.
En lugar de tener:
- `admin_all_projects`
- `superadmin_all_projects`

Crear una sola: `staff_all_projects`
```sql
CREATE POLICY "staff_all_projects" ON public.projects
AS PERMISSIVE FOR ALL
TO public
USING (get_user_role() IN ('admin'::user_role, 'superadmin'::user_role));
```
*Nota Adicional:* Además de consolidar, las funciones propias en políticas (como `get_user_role()`) también deben envolverse en un `(SELECT get_user_role())` si son estables para evitar re-cálculos por fila, o idealmente mapear los roles dentro de `auth.jwt() -> 'user_metadata'`.

---

## 3. Plan de Acción y Siguientes Pasos
1. **No aplicar nada aún:** Revisar junto al equipo cada sugerencia de refactorización de RLS (especialmente las relacionadas con subconsultas para evitar el error de *Auth RLS Initialization Plan*).
2. **Aplicar parches de Seguridad (Urgente):** Limitar ejecución de funciones de creación y asignación retirando permisos a `anon`.
3. **Crear Migración de Rendimiento:** Ejecutar las creaciones de índices para las llaves foráneas indicadas (Punto 2.1).
4. **Simplificar RLS:** Reducir la cantidad de políticas juntando las reglas de administradores.
