# Procedimiento de prueba con lector de pantalla

> **Fecha**: 2026-06-04
> **Propósito**: validar manualmente que el wrapper de SweetAlert2 anuncia correctamente el contenido del modal a usuarios de tecnologías de asistencia.
> **Alcance**: todas las páginas con alerts (`/login`, `/registro`, `/dashboard`, `/admin`, `/mentoria`, `/evaluacion`, `/recuperar-password`, `/actualizar-password`, `/onboarding`).

## Lectores objetivo

| Lector | Plataforma | Comando de descarga |
|---|---|---|
| **NVDA** (recomendado) | Windows | https://www.nvaccess.org/ |
| VoiceOver | macOS | Preinstalado (Cmd + F5) |
| Orca | Linux | `sudo apt install orca` |
| Narrator | Windows | Preinstalado (Win + Ctrl + Enter) |

## Configuración previa

1. Iniciar `npm run dev` y abrir el navegador.
2. Activar el lector de pantalla.
3. Configurar el lector en modo "browse" o "auto" (no "focus" en NVDA).
4. Verificar que el lector pronuncie el título de la página al cargar.

## Casos de prueba

### Caso A — `showError()`

**Setup**: en `/login`, ingresar email válido y contraseña incorrecta.

**Pasos**:

1. Tab hasta el botón "Iniciar sesión".
2. Activar el botón.
3. Escuchar la respuesta del lector.

**Comportamiento esperado**:

- ✅ El lector anuncia el **título** del modal (ej. "Credenciales incorrectas").
- ✅ El lector lee el **cuerpo** del mensaje (ej. "Verificá tu email y contraseña").
- ✅ El lector anuncia el **botón** ("Entendido, botón").
- ✅ El foco queda atrapado dentro del modal.
- ✅ Presionar **Esc** cierra el modal y devuelve el foco al botón "Iniciar sesión".
- ✅ Presionar **Enter** con foco en el botón cierra el modal.

**Comportamiento NO aceptable**:

- ❌ El lector no anuncia el modal (problema de `aria-live`).
- ❌ El foco escapa del modal al fondo de la página.
- ❌ El modal cierra sin devolver el foco al elemento que lo abrió.

### Caso B — `showSuccess()`

**Setup**: en `/recuperar-password`, ingresar un email válido.

**Pasos**:

1. Tab hasta el botón "Enviar enlace".
2. Activar el botón.
3. Escuchar la respuesta del lector.

**Comportamiento esperado**:

- ✅ El lector anuncia el **título** (ej. "Enlace enviado").
- ✅ El lector lee el **cuerpo** del mensaje.
- ✅ El foco vuelve al input de email tras cerrar el modal.

### Caso C — `showConfirm()` destructivo

**Setup**: en `/dashboard`, en el panel del equipo, con un equipo creado, tab hasta "Abandonar Equipo".

**Pasos**:

1. Tab hasta el botón "Abandonar Equipo".
2. Activar el botón.
3. Escuchar la respuesta del lector.
4. Tab dentro del modal para verificar que el foco alterna entre "Cancelar" y "Sí, abandonar".

**Comportamiento esperado**:

- ✅ El lector anuncia el **título** (ej. "Abandonar el equipo").
- ✅ El lector lee el **cuerpo** (ej. "Vas a salir del equipo actual...").
- ✅ El lector anuncia **ambos botones** ("Cancelar, botón" / "Sí, abandonar, botón").
- ✅ El foco inicial está en el botón **menos destructivo** ("Cancelar") para evitar confirmaciones accidentales.
- ✅ El botón destructivo tiene contraste suficiente (4.5:1 mínimo).

### Caso D — `showToast()`

**Setup**: en `/admin`, aprobar un usuario.

**Pasos**:

1. Tab hasta el botón "Aprobar" de un usuario.
2. Activar el botón.
3. Escuchar la respuesta del lector.

**Comportamiento esperado**:

- ✅ El lector anuncia el **mensaje** del toast (ej. "Usuario aprobado correctamente").
- ✅ El toast desaparece automáticamente tras 3 segundos.
- ✅ El toast NO captura el foco (es no modal por diseño).
- ✅ El foco permanece en el botón "Aprobar" tras la acción.

## Checklist de validación

Para cada caso, marcar ✅ / ❌ / N/A:

| Caso | Título anunciado | Cuerpo leído | Foco correcto | Esc cierra | Enter confirma | Contraste |
|---|---|---|---|---|---|---|
| A · showError | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| B · showSuccess | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| C · showConfirm | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| D · showToast | ☐ | ☐ | ☐ | N/A | N/A | ☐ |

## Resultado

| Lector probado | Versión | Resultado | Notas |
|---|---|---|---|
| NVDA | 2024.x | ☐ PASA / ☐ FALLA | |
| VoiceOver | macOS 14+ | ☐ PASA / ☐ FALLA | |
| Orca | 46+ | ☐ PASA / ☐ FALLA | |
| Narrator | Win 11 | ☐ PASA / ☐ FALLA | |

**Criterio de aprobación**: NVDA + VoiceOver deben pasar todos los casos A-D. Orca y Narrator son opcionales pero recomendados.

## Notas de implementación

El wrapper de SweetAlert2 (`src/utils/alerts.js`) hereda las siguientes características de a11y de la librería base:

- `role="dialog"` y `aria-modal="true"` automáticos.
- `aria-labelledby` y `aria-describedby` enlazados al título y contenido.
- Focus trap con `Tab` cycling entre focusables.
- `Esc` cierra el modal.
- `Enter` activa el botón de confirmación por defecto.
- Restauración del foco al elemento que abrió el modal al cerrar.

**Riesgo conocido**: el atributo `aria-live="polite"` en toasts puede ser anunciado de forma tardía por algunos lectores si el lector está en medio de otra lectura. Esto es comportamiento estándar y aceptable.
