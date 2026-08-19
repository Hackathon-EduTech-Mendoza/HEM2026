# Auditoría — Cambiar el tamaño de equipo de 3–5 a 5 fijo

**Fecha:** 2026-08-19 · **Estado:** auditoría de solo lectura, **no se modificó nada**
**Pedido:** subir el mínimo de 3 → 5, dejando el máximo en 5, por logística (muchos
inscriptos para permitir equipos tan chicos).

---

## Resumen en una línea

**Técnicamente es casi gratis; institucionalmente es el cambio más caro que
podemos hacer a 9 días del evento.** El mínimo no está implementado en ningún
lado —es un cartel informativo— así que el software no se rompe. Lo que se rompe
es la coherencia con las **Bases y Condiciones avaladas por la DES**, que dicen
"3 como mínimo" en un documento presentado y publicado.

---

## Parte 1 — Qué tan complejo es (poco)

### El hallazgo principal: `min_team_size` no se valida en ningún lado

Rastreé el valor en el código y en la base de producción. Es **puramente
cosmético**.

| Dónde | Qué hace con el mínimo |
|---|---|
| `event_config.min_team_size` (prod) | Vale `3`. Es la única fuente. |
| `dashboard/index.astro:80` | Lo lee y se lo pasa a `TeamManager`. |
| `TeamManager.astro:85` | Pinta el cartel *"El equipo necesita al menos **3** integrantes para competir"*. |
| `TeamManager.astro:~521` | `minWarning.style.display = members.length < minSize ? '' : 'none'` — muestra u oculta ese cartel. **Fin.** |

Verificado contra la base de prod: consulté las 14 funciones del esquema `public`
y **ninguna menciona `min_team_size`**. Tampoco hay un `CHECK` sobre `teams` que
limite el tamaño (los únicos constraints son la PK, el `join_code` único, las FK
de líder/mentores y `chk_final_position`).

**Consecuencia:** hoy, con el mínimo en 3, un equipo de 1 persona puede existir,
tener código, recibir mentor y entregar proyecto. De hecho **ya pasa**: el equipo
`Ctrl+Edu` tiene 1 integrante y `Los Simuladores` tiene 2. Ninguno de los dos
cumple el mínimo actual y el sistema no los frena.

### El máximo sí se valida — y ya está en 5

`max_team_size` se lee en **un solo lugar** con efecto real: el RPC `join_team`
(`20260522_05_join_team_refactor.sql`, paso 5). Rechaza la unión si el equipo ya
llegó al tope. En prod vale **5**.

O sea: **la mitad del pedido ya está hecha.** "Equipos de 5" = mínimo 5 + máximo
5, y el máximo ya es 5 y sí se hace cumplir.

### Costo técnico del cambio

| Escenario | Trabajo | Riesgo técnico |
|---|---|---|
| **A. Solo cambiar el número** | Un `UPDATE event_config SET value='5' WHERE key='min_team_size'`. Cero código. | **Nulo.** Solo cambia el texto del cartel a "al menos 5". |
| **B. Además hacerlo cumplir** | Migración que agregue la validación (¿dónde? ver abajo) + código + tests. | **Medio-alto**, y hay que decidir *qué* significa "cumplir". |

El escenario B es el que tiene el problema de diseño: **¿en qué momento se
valida un mínimo?** El máximo es fácil (se chequea al entrar). El mínimo no se
puede chequear al entrar —todo equipo empieza en 1—, así que habría que
validarlo al **entregar el proyecto**, y eso significa bloquear la entrega de un
equipo incompleto el día del evento. Es una decisión de producto, no una línea
de SQL.

---

## Parte 2 — Qué tan peligroso es (bastante, pero no por el código)

### 🔴 Riesgo 1 — Contradice las Bases avaladas por la DES

El **Art. 6º** de las Bases dice, textual:

> Cada equipo estará integrado por **3 (tres) integrantes como mínimo y 5 (cinco)
> personas como máximo**

Ese texto está en:

- `src/pages/bases-y-condiciones.astro:93` (la página)
- `public/docs/hackathon-edutech-2026-bases-y-condiciones.pdf` (generado de la página)
- `public/docs/hackathon-edutech-2026-bases-y-condiciones-v11.docx` — **la versión
  presentada a la DES**

Cambiar el mínimo obliga a tocar el Art. 6º, regenerar el PDF (`npm run docs:bases`)
y **abre la pregunta de si hay que volver a presentar las Bases**, porque el .docx
v11 es el que se avaló. Ya veníamos con una brecha entre el .docx y la página
(Anexo II y Art. 12º); esto la haría más grande y sobre un punto sustantivo, no
de redacción.

**Esto no lo decidimos nosotros. Es una consulta a Martín y a la DES.**

### 🔴 Riesgo 2 — El mínimo rígido es frágil ante ausencias

Un mínimo de 5 con máximo de 5 no deja **ninguna holgura**. Si un equipo de 5
tiene 2 ausencias el viernes, queda en 3 y —si el mínimo se hiciera cumplir—
estaría fuera de norma sin haber hecho nada mal.

Hoy el rango 3–5 absorbe exactamente eso. Un hackathon de dos jornadas
presenciales con 176 personas **va a tener ausencias**. Este es, en mi lectura,
el argumento más fuerte en contra de un 5 rígido, y es independiente de lo legal.

### 🟡 Riesgo 3 — La aritmética de egresados queda al filo

Regla vigente (Art. 5º y `max_egresados_per_team`): **máximo 1 egresado por equipo**.

- Egresados aprobados: **34**
- Equipos necesarios para ubicarlos: **≥ 34**
- Equipos que salen de 176 personas de a 5: **35** (176/5 = 35,2)

Entra, pero con **un equipo de margen**. Si baja la asistencia y se arman 30
equipos, hay 4 egresados que no tienen dónde ir sin violar el Art. 5º. Con
equipos de 3–5 la cantidad de equipos es más elástica y el problema no aparece.

⚠️ Además, el Art. 5º prohíbe equipos formados **exclusivamente** por egresados —
regla que, igual que el mínimo, **el sistema no valida**.

### 🟡 Riesgo 4 — El resto no entra en múltiplos de 5

176 personas de a 5 dan 35 equipos y **sobra 1**. El número cambia todos los días
(la inscripción sigue abierta: +42 usuarios pendientes ahora mismo). Con mínimo 5
rígido, el sobrante **no puede formar equipo**. Con 3–5 el sobrante se absorbe
solo. Cualquier regla de "5 exactos" necesita una excepción escrita para el
resto, o la organización la va a improvisar el viernes a las 15:00.

### 🟢 Riesgo 5 — La composición por perfiles aguanta

Pool elegible actual (176):

| Perfil | Personas | Egresados |
|---|---|---|
| Técnico | 94 | 14 |
| Docente | 64 | 15 |
| Otro | 17 | 5 |

Con 35 equipos y los topes de prod (**3 técnicos y 3 docentes** por equipo):

- Técnicos: 35 × 3 = 105 cupos para 94 → entra.
- Docentes: 35 × 3 = 105 cupos para 64 → entra.
- Equipos de 5 con ≤3 técnicos exigen ≥2 no-técnicos: 35 × 2 = 70 ≤ 81 disponibles → entra.

**No hay bloqueo por composición.** Dos observaciones al pasar:

1. Los topes en prod son **3 y 3**, no los 2 y 2 que dice
   `20260522_03_team_composition_limits.sql`. Alguien los subió en prod y la
   migración quedó desactualizada. No es un bug, pero conviene saberlo.
2. La **composición orientativa** del Art. 6º (2 docentes / 2 técnicos / 1
   complementario) ya no refleja el pool real: hay 94 técnicos contra 64
   docentes. Como dice "orientativa", no obliga a nada.

### 🟢 Riesgo 6 — No hay nada que migrar ni tests que romper

- Ningún test unitario ni E2E referencia `min_team_size` ni el tamaño de equipo.
- Solo 3 personas tienen equipo asignado, en 2 equipos. **No hay que recomponer
  equipos existentes**: prácticamente nadie se agrupó todavía.
- `teams_enabled` está en **`false`**: la formación de equipos ni siquiera está
  abierta al público.

---

## Parte 3 — El contexto que cambia todo

**Los equipos no los arman los usuarios: los arma la organización, en persona.**

- Art. 6º: *"La organización conformará los grupos respetando la composición requerida"*.
- Anexo I, viernes 28: *"15:00 a 16:00: recepción, acreditación y **conformación de
  equipos, a partir de una dinámica coordinada por la organización**"*.
- `teams_enabled = false` en prod, consistente con eso.

Esto reordena las prioridades. El mínimo **no es una barrera que los
participantes choquen en la web** — es una instrucción para quien arma los grupos
el viernes a la tarde. Y para eso **no hace falta tocar el software**: alcanza
con que la organización arme grupos de 5.

---

## Recomendación

**Separar el pedido en dos, porque son dos cosas distintas:**

### 1. La logística del día D → no requiere ningún cambio técnico

Si el objetivo es que los equipos salgan de 5 para que 176 personas entren en una
cantidad manejable de grupos, eso se resuelve **en la dinámica de conformación
del viernes**, que ya es presencial y coordinada. Es gratis, reversible y no toca
las Bases.

### 2. El número publicado en las Bases → requiere autorización

Si además se quiere que las Bases **digan** 5, hay que:

- Consultar a Martín / la DES si se puede modificar el Art. 6º de un documento ya avalado.
- Tocar 3 textos: `bases-y-condiciones.astro:93`, `FAQ.astro:34`, `InfoCards.astro:37`.
- Regenerar el PDF con `npm run docs:bases`.
- Decidir qué hacer con el .docx v11 (¿v12? ¿se vuelve a presentar?).
- `UPDATE event_config SET value='5' WHERE key='min_team_size'` para el cartel del dashboard.

**Mi sugerencia concreta:** si se avanza, publicar **"equipos de 5 integrantes
(mínimo 4)"** en lugar de un 5 rígido. Conserva el objetivo logístico, deja
holgura para ausencias y para el resto de la división, y evita que un equipo
diezmado por dos faltas quede formalmente fuera de norma. Un 5 exacto sin
excepción escrita es una regla que la propia organización va a tener que violar
el mismo viernes.

### Lo que NO recomiendo

Implementar la **validación** del mínimo (escenario B) a 9 días del evento. Hoy
no existe, nadie la extraña, y meterla implica bloquear entregas de proyecto —
justo el camino crítico del sábado. Si el mínimo se incumple, que lo resuelva la
organización mirando la tabla, no un `RETURN json_build_object('ok', false, ...)`
a las 19:00 del día de la entrega.

---

## Anexo — Archivos que tocaría cada opción

| Archivo | Qué dice hoy | Opción 1 (solo logística) | Opción 2 (publicar el cambio) |
|---|---|---|---|
| `event_config.min_team_size` (prod) | `3` | sin cambios | `UPDATE` a `5` |
| `src/pages/bases-y-condiciones.astro:93` | "3 (tres) … mínimo y 5 (cinco) … máximo" | sin cambios | reescribir Art. 6º |
| `src/components/FAQ.astro:34` | "mínimo de 3 y un máximo de 5" | sin cambios | reescribir |
| `src/components/InfoCards.astro:37` | "Equipos de 3 a 5 personas" | sin cambios | reescribir |
| `public/docs/…bases-y-condiciones.pdf` | generado de la página | sin cambios | `npm run docs:bases` |
| `public/docs/…v11.docx` | presentado a la DES | sin cambios | **decisión pendiente** |
| `TeamManager.astro`, `dashboard/index.astro` | leen el valor de config | sin cambios | sin cambios (leen de config) |
| `join_team` (RPC) | valida solo el máximo | sin cambios | sin cambios |

---

## Datos de producción usados (2026-08-19 00:18 UTC)

- **176** usuarios aprobados (elegibles) · **42** pendientes · **34** egresados aprobados · **19** mentores aprobados
- **2** equipos existentes, con **1** y **2** integrantes · **3** personas con equipo
- `teams_enabled = false` · `max_team_size = 5` · `min_team_size = 3` ·
  `max_egresados_per_team = 1` · `max_tecnicos_per_team = 3` · `max_docentes_per_team = 3`

⚠️ **La inscripción sigue abierta y los números se mueven todos los días.** Los
elegibles pasaron de 163 a 176 durante esta misma sesión. Volver a contar antes
de usar cualquiera de estos números para decidir.
