import { useEffect, useRef, useState } from 'react';
import { useModalStore } from '../store/useModalStore';

export function ConfirmModal() {
  const modal = useModalStore((s) => s.confirm);
  const resolve = useModalStore((s) => s._confirmResolve);
  const close = useModalStore((s) => s.closeConfirm);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modal) okRef.current?.focus();
  }, [modal]);

  // Close on Escape
  useEffect(() => {
    if (!modal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resolve?.(false);
        close();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modal, resolve, close]);

  if (!modal) return null;

  const isDanger = modal.variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modal.title ? 'confirm-modal-title' : undefined}
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => {
        resolve?.(false);
        close();
      }}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-xl border p-6 shadow-2xl"
        style={{
          background: 'var(--color-bg-panel)',
          borderColor: isDanger
            ? 'rgba(239, 68, 68, 0.35)'
            : 'var(--color-border-strong)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        {modal.title && (
          <h3
            id="confirm-modal-title"
            className="text-base font-bold"
            style={{
              color: isDanger
                ? 'var(--color-status-failed)'
                : 'var(--color-text-primary)',
            }}
          >
            {modal.title}
          </h3>
        )}

        {/* Message */}
        <p
          className="whitespace-pre-wrap text-sm leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {modal.message}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              resolve?.(false);
              close();
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {modal.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={okRef}
            type="button"
            onClick={() => {
              resolve?.(true);
              close();
            }}
            className="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
            style={{
              background: isDanger
                ? 'var(--color-status-failed)'
                : 'var(--color-brand-accent)',
              color: isDanger ? '#fff' : '#000',
            }}
          >
            {modal.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertModal() {
  const modal = useModalStore((s) => s.alert);
  const close = useModalStore((s) => s.closeAlert);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modal) okRef.current?.focus();
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modal, close]);

  if (!modal) return null;

  const isSuccess = modal.variant === 'success';
  const isError = modal.variant === 'error';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={modal.title ? 'alert-modal-title' : undefined}
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={close}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-xl border p-6 shadow-2xl"
        style={{
          background: 'var(--color-bg-panel)',
          borderColor: isError
            ? 'rgba(239, 68, 68, 0.35)'
            : isSuccess
              ? 'rgba(16, 185, 129, 0.35)'
              : 'var(--color-border-strong)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {modal.title && (
          <h3
            id="alert-modal-title"
            className="text-base font-bold"
            style={{
              color: isError
                ? 'var(--color-status-failed)'
                : isSuccess
                  ? 'var(--color-status-done)'
                  : 'var(--color-text-primary)',
            }}
          >
            {modal.title}
          </h3>
        )}

        <p
          className="whitespace-pre-wrap text-sm leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {modal.message}
        </p>

        <div className="flex justify-end pt-1">
          <button
            ref={okRef}
            type="button"
            onClick={close}
            className="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
            style={{
              background: 'var(--color-brand-accent)',
              color: '#000',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export function PromptModal() {
  const modal = useModalStore((s) => s.prompt);
  const resolve = useModalStore((s) => s._promptResolve);
  const close = useModalStore((s) => s.closePrompt);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modal) {
      setValue(modal.defaultValue ?? '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resolve?.(null);
        close();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modal, resolve, close]);

  if (!modal) return null;

  const handleSubmit = () => {
    resolve?.(value);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modal.title ? 'prompt-modal-title' : undefined}
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => {
        resolve?.(null);
        close();
      }}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-xl border p-6 shadow-2xl"
        style={{
          background: 'var(--color-bg-panel)',
          borderColor: 'var(--color-border-strong)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {modal.title && (
          <h3
            id="prompt-modal-title"
            className="text-base font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {modal.title}
          </h3>
        )}

        <p
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {modal.message}
        </p>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          placeholder={modal.placeholder}
          className="w-full rounded-lg px-3 py-2 text-sm"
        />

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              resolve?.(null);
              close();
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
            style={{
              background: 'var(--color-brand-accent)',
              color: '#000',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
