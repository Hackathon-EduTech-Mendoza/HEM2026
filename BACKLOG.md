# Backlog HEM2026

Mejoras identificadas pendientes de aprobación / información externa.

## Bloqueado por información externa

### 1. Definir el formato final del puntaje con el administrador del concurso
La rúbrica ya está implementada (6 criterios, escala 1–5, pesos definidos en
`src/lib/rubric.ts`), pero queda **una decisión abierta**: si el resultado oficial
se toma del **puntaje ponderado** o de la **suma directa**. El panel de resultados
muestra las dos columnas justamente para poder compararlas con datos reales antes
de decidir. Hoy el ranking se ordena por el ponderado.

Si se opta por la suma directa, solo cambia el `ORDER BY` de la vista
`project_leaderboard` y el `.order()` de `/admin`. Si se ajusta algún peso, hay que
cambiarlo en `src/lib/rubric.ts` **y** en la vista SQL (están duplicados a propósito,
con comentarios cruzados).

## Aprobadas a la espera de implementación

### 2. Normalizar Instagram al guardar
Sacar `@`, espacios y URLs completas antes del update en dashboard/onboarding,
para que mentores/admin reciban un handle limpio.

### 3. Carrera en la carga de "Entrega de Proyecto"
`ProjectSubmission.astro` pone `Cargando...` en los inputs y los vacía cuando
responde el fetch inicial: si el usuario empieza a escribir antes de que
responda (conexión lenta), se le borra lo tipeado. Deshabilitar los campos
durante la carga en lugar de pisarles el valor. (Detectado por el test E2E.)

### 4. Validar teléfono (WhatsApp) como el DNI
Agregar `pattern`/`inputmode="numeric"` y limpieza de caracteres no numéricos,
consistente con el campo DNI.
