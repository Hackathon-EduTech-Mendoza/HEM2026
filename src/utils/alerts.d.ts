/**
 * src/utils/alerts.d.ts
 *
 * Tipos públicos del wrapper de SweetAlert2.
 * Permite autocompletado y verificación estática en componentes Astro.
 */

import type { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';

export type ConfirmIcon = Extract<SweetAlertIcon, 'warning' | 'question' | 'info'>;

export interface ShowConfirmOptions {
    title: string;
    text?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    icon?: ConfirmIcon;
}

export type ToastIcon = Extract<SweetAlertIcon, 'success' | 'error' | 'warning' | 'info'>;

export const showError: (
    title: string,
    text?: string,
    confirmText?: string,
) => Promise<SweetAlertResult>;

export const showSuccess: (
    title: string,
    text?: string,
    confirmText?: string,
) => Promise<SweetAlertResult>;

export const showConfirm: (options: ShowConfirmOptions) => Promise<boolean>;

export const showToast: (
    icon: ToastIcon,
    title: string,
    timer?: number,
) => Promise<SweetAlertResult>;

export const PALETTE: {
    readonly bg: string;
    readonly bgAlt: string;
    readonly border: string;
    readonly text: string;
    readonly textMuted: string;
    readonly primary: string;
    readonly success: string;
    readonly danger: string;
    readonly warning: string;
};

declare const _default: {
    showError: typeof showError;
    showSuccess: typeof showSuccess;
    showConfirm: typeof showConfirm;
    showToast: typeof showToast;
    PALETTE: typeof PALETTE;
};

export default _default;
