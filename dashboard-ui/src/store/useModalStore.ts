import { create } from 'zustand';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface AlertOptions {
  title?: string;
  message: string;
  variant?: 'default' | 'success' | 'error';
}

interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
}

interface ModalState {
  confirm: ConfirmOptions | null;
  alert: AlertOptions | null;
  prompt: PromptOptions | null;

  _confirmResolve: ((value: boolean) => void) | null;
  _promptResolve: ((value: string | null) => void) | null;

  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
  showAlert: (options: AlertOptions) => void;
  showPrompt: (options: PromptOptions) => Promise<string | null>;

  closeConfirm: () => void;
  closeAlert: () => void;
  closePrompt: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  confirm: null,
  alert: null,
  prompt: null,
  _confirmResolve: null,
  _promptResolve: null,

  showConfirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({ confirm: options, _confirmResolve: resolve });
    });
  },

  showAlert: (options) => {
    set({ alert: options });
  },

  showPrompt: (options) => {
    return new Promise<string | null>((resolve) => {
      set({ prompt: options, _promptResolve: resolve });
    });
  },

  closeConfirm: () => set({ confirm: null, _confirmResolve: null }),
  closeAlert: () => set({ alert: null }),
  closePrompt: () => set({ prompt: null, _promptResolve: null }),
}));
