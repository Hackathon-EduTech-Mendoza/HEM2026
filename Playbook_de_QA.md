# Playbook de QA — HEM2026

Este documento contiene misiones de pruebas manuales End-to-End para verificar el correcto funcionamiento de la plataforma en todos sus roles antes de salir a producción.

## 🕵️‍♂️ Misión 1: Rol SuperAdmin
**Objetivo**: Validar el control total de la plataforma y configuraciones globales.
- [ ] Iniciar sesión como SuperAdmin en `/login`.
- [ ] Navegar a `/admin` y verificar el acceso a la pestaña "Configuración".
- [ ] Activar y desactivar el switch "Formación de Equipos" y verificar que los cambios persisten.
- [ ] Ir a la pestaña "Usuarios", buscar a un usuario recién registrado (estado 'pendiente') y cambiarlo a 'aprobado'.
- [ ] Ir a la pestaña "Comunicados", redactar un mensaje de prueba y enviarlo a los "Participantes". Verificar recepción.

## 🛡️ Misión 2: Rol Admin
**Objetivo**: Validar gestión de usuarios, asignación de mentores y revisión de resultados (sin permisos destructivos globales).
- [ ] Iniciar sesión como Admin. Navegar a `/admin`.
- [ ] Ir a la pestaña "Usuarios" e intentar cambiar el rol de un usuario a "Superadmin". (La UI debe bloquearlo).
- [ ] Ir a la pestaña "Mentoría", seleccionar un equipo sin mentor y asignarle un "Mentor Técnico (Slot 1)" y un "Mentor Pedagógico (Slot 2)".
- [ ] Guardar las asignaciones y comprobar que aparece el SweetAlert2 verde (`showSuccess`).
- [ ] Revisar la pestaña "Resultados" y confirmar que se muestra el Leaderboard con los puntajes calculados.

## 🚀 Misión 3: Rol Participante (Mínimo 3 testers)
**Objetivo**: Validar flujo de inscripción, dashboard, UX/UI, equipos y seguridad.
- [ ] **Tester A**: Crear cuenta en `/registro` con datos falsos. Verificar la recepción de correos transaccionales y el **diseño** del email en registro.
- [ ] **Tester A**: Cerrar sesión y probar el flujo de **recuperación** de contraseña, comprobando la recepción del correo y su diseño.
- [ ] Intentar acceder a `/admin` y `/evaluacion`. El sistema (middleware) debe redirigir a `/dashboard`.
- [ ] En `/dashboard`, completar el formulario de Onboarding. (Verificar que los errores de validación lanzan un modal de error de SweetAlert2).
- [ ] Si la formación de equipos está activa, ir a la pestaña "Mi Equipo", crear un equipo nuevo. Editar su nombre y eliminarlo (validar CRUD de equipos). Crear un equipo definitivo y copiar el "Código de unión".
- [ ] **Tester B**: Entrar a `/dashboard`, intentar unirse al equipo de Tester A usando el código de unión.
- [ ] **Tester C**: Unirse al mismo equipo.
- [ ] **Tester A (Líder)**: Subir el proyecto desde el componente de entrega. Verificar edición y eliminación para validar el CRUD de equipos y proyectos. Verificar responsividad móvil (cortes de texto en el título del proyecto).

## 🧭 Misión 4: Rol Mentor
**Objetivo**: Validar visibilidad de equipos asignados y protección de rutas.
- [ ] Iniciar sesión como Mentor. Intentar entrar a `/dashboard` (debe redirigir a `/mentoria` o mostrar vista de espera).
- [ ] En `/mentoria`, verificar que aparezca la tarjeta del equipo asignado por el Admin en la Misión 2.
- [ ] Verificar que se listen los integrantes correctos y el estado del proyecto (con sus enlaces).
- [ ] En tamaño móvil (responsive), comprobar que las tarjetas no desbordan la pantalla (UX/UI).

## ⚖️ Misión 5: Rol Juez
**Objetivo**: Validar sistema de evaluación y rúbricas.
- [ ] Iniciar sesión como Juez y entrar a `/evaluacion`.
- [ ] Verificar la sección "Pendientes de Evaluación". Seleccionar un proyecto haciendo clic en "Evaluar Proyecto".
- [ ] Desplegar el **instructivo para el jurado** y verificar que se lean los 6 criterios con su peso.
- [ ] En el modal, puntuar los 6 criterios con los botones del 1 al 5 (Problema, Solución,
      Innovación, Factibilidad, Impacto, Comunicación).
- [ ] Intentar guardar con criterios sin puntuar: debe avisar cuáles faltan y no guardar.
- [ ] Verificar que los totales en vivo (suma directa /30 y ponderado /100) se actualicen al puntuar.
- [ ] Dejar un feedback escrito y guardar.
- [ ] Comprobar que el proyecto se mueve automáticamente a la sección "Evaluados".
- [ ] Abrir otro proyecto y confirmar que el formulario arranca **en blanco** (no arrastra la puntuación anterior).
- [ ] ⚠️ Conocido: hoy **no se puede editar ni borrar** una evaluación ya guardada desde la UI.
