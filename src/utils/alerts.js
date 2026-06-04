/**
 * src/utils/alerts.js
 *
 * Wrapper centralizado de SweetAlert2 alineado al Design System de HEM2026.
 * Reemplaza alert(), confirm() y prompt() nativos por modales accesibles,
 * estéticas y no bloqueantes para el hilo principal.
 *
 * Uso:
 *   import { showError, showSuccess, showConfirm, showToast } from '@/utils/alerts';
 *
 * Convenciones:
 *   - showError     → feedback negativo (formularios, validaciones, API errors)
 *   - showSuccess   → feedback positivo (operación completada)
 *   - showConfirm   → decisión crítica antes de acciones destructivas
 *   - showToast     → notificación efímera (top-right, auto-dismiss)
 *
 * Nota: este módulo sólo debe importarse desde <script> de cliente en
 * componentes Astro. Nunca en el frontmatter (server-side).
 */

import Swal from 'sweetalert2';

/* ------------------------------------------------------------------ */
/*  PALETA — única fuente de verdad del tema de alertas               */
/* ------------------------------------------------------------------ */
const PALETTE = Object.freeze({
    bg:        '#1a1a1a',  // fondo principal (oscuro)
    bgAlt:     '#262626',  // fondo secundario (botón cancelar)
    border:    '#374151',  // borde sutil del popup
    text:      '#f3f4f6',  // texto principal
    textMuted: '#9ca3af',  // texto secundario
    primary:   '#d946ef',  // fucsia — acción principal
    success:   '#a3e635',  // verde lima — éxito
    danger:    '#ef4444',  // rojo — error / acción destructiva
    warning:   '#f97316',  // naranja — advertencia
});

/* ------------------------------------------------------------------ */
/*  CONFIG BASE — se fusiona con cada llamada                         */
/* ------------------------------------------------------------------ */
const baseConfig = {
    background:        PALETTE.bg,
    color:             PALETTE.text,
    confirmButtonColor: PALETTE.primary,
    cancelButtonColor:  PALETTE.bgAlt,
    denyButtonColor:    PALETTE.danger,
    iconColor:          PALETTE.primary,
    buttonsStyling:     true,
    heightAuto:         false,
    scrollbarPadding:   false,
    reverseButtons:     true,
    focusConfirm:       false,
    allowEnterKey:      true,
    allowEscapeKey:     true,
    backdrop:           'rgba(0, 0, 0, 0.65)',
    customClass: {
        popup:            'swal-hem-popup',
        title:            'swal-hem-title',
        htmlContainer:    'swal-hem-content',
        confirmButton:    'swal-hem-btn swal-hem-btn--primary',
        cancelButton:     'swal-hem-btn swal-hem-btn--cancel',
        denyButton:       'swal-hem-btn swal-hem-btn--danger',
        icon:             'swal-hem-icon',
        actions:          'swal-hem-actions',
    },
    showClass: {
        popup:  'swal2-show',
        backdrop: 'swal2-backdrop-show',
    },
    hideClass: {
        popup:  'swal2-hide',
        backdrop: 'swal2-backdrop-hide',
    },
};

/* ------------------------------------------------------------------ */
/*  HELPERS INTERNOS                                                  */
/* ------------------------------------------------------------------ */
const normalize = (title, text) => ({
    title: String(title ?? 'Atención'),
    text:  text != null ? String(text) : undefined,
});

/* ------------------------------------------------------------------ */
/*  API PÚBLICA                                                       */
/* ------------------------------------------------------------------ */

/**
 * Modal de error estándar.
 * @param {string} title
 * @param {string} [text]
 * @param {string} [confirmText='Entendido']
 */
export const showError = (title, text, confirmText = 'Entendido') =>
    Swal.fire({
        ...baseConfig,
        ...normalize(title, text),
        icon: 'error',
        confirmButtonText: confirmText,
        confirmButtonColor: PALETTE.danger,
        iconColor: PALETTE.danger,
    });

/**
 * Modal de éxito estándar.
 * @param {string} title
 * @param {string} [text]
 * @param {string} [confirmText='Aceptar']
 */
export const showSuccess = (title, text, confirmText = 'Aceptar') =>
    Swal.fire({
        ...baseConfig,
        ...normalize(title, text),
        icon: 'success',
        confirmButtonText: confirmText,
        confirmButtonColor: PALETTE.success,
        iconColor: PALETTE.success,
    });

/**
 * Modal de confirmación.
 * Devuelve una Promise<boolean> resuelta con `true` si el usuario confirma.
 *
 * @param {object}  opts
 * @param {string}  opts.title
 * @param {string}  [opts.text]
 * @param {string}  [opts.confirmText='Confirmar']
 * @param {string}  [opts.cancelText='Cancelar']
 * @param {boolean} [opts.destructive=false]  // si true, botón en rojo
 * @param {'warning'|'question'|'info'} [opts.icon='warning']
 * @returns {Promise<boolean>}
 */
export const showConfirm = ({
    title,
    text,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    destructive = false,
    icon = 'warning',
}) =>
    Swal.fire({
        ...baseConfig,
        ...normalize(title, text),
        icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        confirmButtonColor: destructive ? PALETTE.danger : PALETTE.primary,
        iconColor: destructive ? PALETTE.danger : PALETTE.warning,
    }).then((result) => result.isConfirmed);

/**
 * Toast efímero para feedback no bloqueante.
 * @param {'success'|'error'|'warning'|'info'} icon
 * @param {string} title
 * @param {number} [timer=3000]
 */
export const showToast = (icon, title, timer = 3000) =>
    Swal.fire({
        ...baseConfig,
        toast: true,
        position: 'top-end',
        icon,
        title: String(title ?? ''),
        showConfirmButton: false,
        timer,
        timerProgressBar: true,
        background: PALETTE.bgAlt,
    });

/* ------------------------------------------------------------------ */
/*  INYECCIÓN DE CSS MÍNIMO (popup radius, tipografía, animaciones)  */
/*  Sólo se inyecta una vez, la primera vez que se carga el módulo.   */
/* ------------------------------------------------------------------ */
const STYLE_ID = 'swal-hem-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .swal-hem-popup {
            border: 1px solid ${PALETTE.border};
            border-radius: 14px;
            font-family: var(--font-body, system-ui, sans-serif);
            padding: 1.75rem;
        }
        .swal-hem-title {
            color: ${PALETTE.text};
            font-family: var(--font-heading, system-ui, sans-serif);
            font-size: 1.35rem;
            font-weight: 700;
        }
        .swal-hem-content {
            color: ${PALETTE.textMuted};
            font-size: 0.95rem;
            line-height: 1.55;
        }
        .swal-hem-icon {
            margin: 0.5rem auto 1rem;
            border: none !important;
        }
        .swal-hem-btn {
            font-family: var(--font-heading, system-ui, sans-serif);
            font-weight: 600;
            border-radius: 10px;
            padding: 0.65rem 1.25rem;
            font-size: 0.95rem;
            box-shadow: none !important;
        }
        .swal-hem-btn:focus {
            box-shadow: 0 0 0 3px rgba(217, 70, 239, 0.35) !important;
        }
        .swal2-actions {
            gap: 0.5rem;
        }
    `;
    document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  EXPORT POR DEFECTO (para import default)                          */
/* ------------------------------------------------------------------ */
export default {
    showError,
    showSuccess,
    showConfirm,
    showToast,
    PALETTE,
};
