# Backlog HEM2026

Mejoras identificadas pendientes de aprobación / información externa.

## Bloqueado por información externa

### 1. Rúbrica oficial de evaluación (esperando al administrador del concurso)
El instructivo PDF solo lista los nombres de los 7 criterios; falta confirmar:
- **Escala** por criterio (hoy: 1–10).
- **Pesos** por criterio (hoy: todos iguales, puntaje final = suma directa, máx. 70).

Si hay pesos, solo cambia la fórmula de `final_score` en la vista `project_leaderboard`
y el total mostrado en `/evaluacion`. Si cambia la escala, además cambian los
`CHECK` de la tabla `evaluations` y los sliders del form.

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
