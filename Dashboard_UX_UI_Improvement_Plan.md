# Plan de Mejora UX/UI — Dashboard Participante (`/dashboard`)

## Problemas Detectados

### P0 — Bugs / Regresiones vs mentoria.astro
| # | Problema | Impacto | Archivo:Línea |
|---|----------|---------|---------------|
| 1 | **Realtime SOS usa `window.location.reload()`** cuando ticket finaliza/expira | UX rota: pantalla parpadea, pierde scroll, estado transitorio. En mentoria.astro ya se hizo reactivo. | `index.astro:818` |
| 2 | **SOS Timer solo muestra elapsed** (0:00 → N:NN) sin tope | Participante no sabe cuánto tiempo le queda. El plan indica que debe ser countdown con `mentorSessionDuration`. | `index.astro:840-848` |
| 3 | **Botón SOS no da feedback inmediato** tras RPC exitoso | Queda en "Enviando..." hasta que Realtime actualice. En mentoria.astro ya se aplicó feedback instantáneo. | `index.astro:789-801` |
| 4 | **Falta `data-session-duration`** en `#sos-container` | El timer no puede calcular countdown sin este dato del server. | `index.astro:269` |

### P1 — UX / Layout
| # | Problema | Solución |
|---|----------|----------|
| 5 | Mentor + SOS section comprimidos dentro de `.profile-card` (columna 6fr derecha) | Extraer mentor+SOS a su propia sección debajo del grid en mobile, o reorganizar layout |
| 6 | Sin animación en cambios de estado SOS | Agregar `fadeInUp` en transiciones de status text y timer (como en mentoria.astro) |
| 7 | `.btn-danger` usa hardcoded `#dc2626` / `#b91c1c` | Usar variable CSS para consistencia con dark mode |
| 8 | `.form-error` usa hardcoded rojo | Usar variables CSS del design system |

### P2 — Nice-to-have
| # | Problema | Solución |
|---|----------|----------|
| 9 | Sin indicador visual de cooldown entre pedidos SOS | Mostrar texto cooldown post-finalización |
| 10 | Status badge "PENDIENTE" poco visible | Considerar animación pulse suave |

---

## Implementación (orden de ejecución)

### Hotfix 5 — Paridad Realtime SOS con mentoria.astro
1. Agregar `data-session-duration={mentorSessionDuration}` al `#sos-container`
2. Reemplazar `window.location.reload()` por actualización reactiva del DOM:
   - `finalizado` → mostrar mensaje "✅ Sesión finalizada", resetear botón a "Pedir Ayuda (SOS)"
   - `expirado` → mostrar mensaje "⏰ Tiempo agotado", resetear botón
3. Botón SOS: feedback inmediato tras `request_help()` exitoso → "Pedido Enviado ✓"
4. Timer: countdown desde `mentorSessionDuration` en vez de elapsed

### Hotfix 6 — Layout y consistencia visual
5. Reorganizar mentor+SOS fuera de `.profile-card` en su propia card
6. Agregar `fadeInUp` a status text transitions
7. Reemplazar colores hardcoded con CSS variables
8. Agregar soporte para `data-session-duration` en timer countdown

---

## Detalles Técnicos

### Countdown Timer
```
remainingSecs = (mentorSessionDuration * 60) - elapsedSecs
if remainingSecs <= 0 → mostrar "Tiempo agotado"
```

### Realtime Reactivo (patrón de mentoria.astro)
```js
// En vez de window.location.reload():
if (ticket.status === 'finalizado') {
  sosStatusText.textContent = '✅ Sesión finalizada. Podés pedir ayuda nuevamente si lo necesitás.';
  sosBtn.disabled = false;
  sosBtn.textContent = 'Pedir Ayuda (SOS)';
  sosBtn.classList.remove('btn-disabled');
  sosBtn.classList.add('btn-danger');
  currentStatus = '';
  startedAt = '';
}
```

### Variables CSS para rojo (añadir a :root themes)
```css
--danger: #dc2626;
--danger-h: #b91c1c;
--danger-bg: rgba(220, 38, 38, 0.1);
--danger-brd: rgba(220, 38, 38, 0.3);
```
