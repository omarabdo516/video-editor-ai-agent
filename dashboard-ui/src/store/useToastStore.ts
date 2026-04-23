import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Auto-dismiss delay in ms. 0 = persistent (manual dismiss only). */
  duration: number;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  add: (message: string, variant?: ToastVariant, duration?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let _nextId = 0;

const MAX_TOASTS = 6;
const DEFAULT_DURATION = 4500;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  add: (message, variant = 'info', duration = DEFAULT_DURATION) => {
    const id = `toast-${++_nextId}`;
    const toast: Toast = { id, message, variant, duration, createdAt: Date.now() };

    set((s) => {
      // Keep max visible toasts — drop oldest if overflow
      const next = [...s.toasts, toast];
      return { toasts: next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next };
    });

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }

    return id;
  },

  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  clear: () => set({ toasts: [] }),
}));

// Convenience helpers — importable anywhere without the hook
export const toast = {
  success: (msg: string, duration?: number) =>
    useToastStore.getState().add(msg, 'success', duration),
  error: (msg: string, duration?: number) =>
    useToastStore.getState().add(msg, 'error', duration ?? 6000),
  info: (msg: string, duration?: number) =>
    useToastStore.getState().add(msg, 'info', duration),
  warning: (msg: string, duration?: number) =>
    useToastStore.getState().add(msg, 'warning', duration ?? 5500),
};
