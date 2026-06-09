# Actualización de Landing Page (Code Freeze)

Se actualizará la información pública de la plataforma para la Hackathon EduTech 2026. Los cambios serán netamente estéticos y de contenido, respetando la modalidad de Code Freeze (sin tocar lógica).

## Open Questions
1. **Días de la semana:** Asumí que las nuevas fechas caen en Miércoles 26 (Virtual), Viernes 28 y Sábado 29 (Presencial). ¿Es correcto?
2. **Logos de Aliados Estratégicos:** ¿Tienes los logos listos en alguna carpeta para pasarlos a `public/`, o prefieres que armemos la grilla de "Aliados Estratégicos" utilizando iconos SVG genéricos (o solo el texto estilizado) hasta que tengamos los recursos oficiales?
3. **Ubicación de Aliados:** Propongo colocar la nueva sección de "Aliados Estratégicos" justo debajo del componente `Organizers` (Organizan). ¿Te parece bien esta ubicación?
4. **Delegación (Teamwork):** Invocaste el comando `/teamwork-preview`. ¿Deseas que el escuadrón de agentes ejecute estas tareas o prefieres que lo implemente yo directamente? He preparado el borrador en `prompt_draft.md` por si elegimos la vía multi-agente.

## Proposed Changes

---

### Global: Actualización de Fechas
Se actualizarán los textos y configuraciones del cronómetro para reflejar las nuevas fechas: 26, 28 y 29 de agosto.

#### [MODIFY] src/components/Hero.astro
- Cambiar la variable `EVENT_START_DATE` a `'2026-08-26T21:30:00-03:00'`.
- Actualizar los *chips* de fecha de "19 Ago" a "26 Ago", y "21-22 Ago" a "28-29 Ago".

#### [MODIFY] src/pages/index.astro
- En el `jsonLd`, cambiar `startDate` a `"2026-08-26..."` y `endDate` a `"2026-08-29..."`.

#### [MODIFY] src/components/Schedule.astro
- Cambiar los encabezados del timeline a las nuevas fechas correspondientes.

#### [MODIFY] src/pages/bases-y-condiciones.astro
- Actualizar el apartado de fechas en las viñetas del cronograma.

#### [MODIFY] src/components/FAQ.astro
- Actualizar la fecha de las jornadas presenciales en la respuesta de la FAQ correspondiente.

---

### Premios: Ocultar Incubadora
Mantener el código fuente de la mención especial pero evitar su renderizado.

#### [MODIFY] src/components/Prizes.astro
- Envolver la sección del premio "Beca Incubadora UNCUYO" (aprox. línea 42) dentro de comentarios HTML `<!-- ... -->`.

---

### Nueva Sección: Aliados Estratégicos
Crear una sección para destacar a las 4 instituciones aliadas.

#### [NEW] src/components/Allies.astro
- Crear un nuevo componente con el título "Aliados Estratégicos" y bajada "Instituciones que impulsan la innovación aportando mentorías, capacitaciones y premios.".
- Implementar una grilla responsiva CSS (basada en el Design System actual) con tarjetas para:
  1. Fundación Undercode
  2. Google for Education
  3. PMI Andes Patagonia
  4. Universidad Siglo 21

#### [MODIFY] src/pages/index.astro
- Importar y renderizar `<Allies />` debajo de `<Organizers />`.

---

### Footer: Actualización de Créditos
#### [MODIFY] src/components/Footer.astro
- Reemplazar el span del copyright por la nueva estructura multi-línea, manteniendo las clases de color gris apagado (`--txt-2`) de la interfaz actual.

## Verification Plan
### Manual Verification
- Comprobar visualmente que el reloj de cuenta regresiva apunte al 26 de Agosto.
- Verificar que "Incubadora" no aparezca en pantalla.
- Revisar aspecto responsivo de la grilla de Aliados Estratégicos.
- Validar los créditos en el footer.
