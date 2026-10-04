import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (kind: ToastKind, title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

let counter = 0;
const nextId = (): string => `toast-${++counter}`;

const AUTO_DISMISS_MS = 4200;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (kind, title, message) => {
    const id = nextId();
    set((s) => ({ toasts: [...s.toasts, { id, kind, title, message }] }));
    window.setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Slim imperative API used from mutations: `toast.success('Saved')`. */
export const toast = {
  success: (title: string, message?: string) => useToastStore.getState().push('success', title, message),
  error: (title: string, message?: string) => useToastStore.getState().push('error', title, message),
  info: (title: string, message?: string) => useToastStore.getState().push('info', title, message),
};