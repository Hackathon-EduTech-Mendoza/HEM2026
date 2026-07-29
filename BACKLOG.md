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

## Sitio público — noticias (detectado 2026-07-28)

### 5. Revisar los textos de la nota de la rectora
Los títulos de los tres videos (`Parte 1: la visita al programa Cada Día`, etc.)
y los `alt` de las fotos se escribieron **sin ver el material**, de forma
genérica. Alguien que haya visto los clips debería ajustarlos en
`src/content/noticias/rectora-ies-9023-en-cada-dia-el-nueve.md`. Los `alt` son lo
que leen los lectores de pantalla, así que conviene que describan la foto real.

También falta confirmar la **fecha de la nota**: se puso `2026-07-28` porque el
texto decía "Hoy" sin fecha explícita.

### 6. Las tarjetas de noticia no muestran imagen
`NewsCard.astro` es solo texto. Ahora que las notas tienen `imagen`, mostrarla
como miniatura levantaría mucho la sección del home y el listado. Hay que definir
qué hacer con las que no tienen imagen (las de prensa externa y los avisos):
placeholder con el color de la categoría, o grilla que tolere tarjetas mixtas.

### 7. `/noticias` no está enlazada en la navegación
Se llega solo por el botón "Ver todas las noticias" del home. Conviene sumarla al
navbar y/o a la columna "Evento" del footer, para que sea alcanzable desde
cualquier página.

### 8. Los videos propios no tienen `poster`
Sin miniatura, el navegador muestra el primer fotograma, que suele ser negro o
un frame cualquiera. El campo `poster` ya está soportado en el schema: falta
generar una imagen por video y cargarla.

### 9. Feed RSS de noticias
Con la colección ya armada, `@astrojs/rss` son unas pocas líneas. Útil si algún
medio o la DGE quiere sindicar las novedades. Prioridad baja.
