import { useToastStore, type Toast, type ToastVariant } from '../store/useToastStore';

function variantStyles(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return {
        border: 'rgba(16, 185, 129, 0.4)',
        bg: 'rgba(16, 185, 129, 0.1)',
        accent: 'var(--color-status-done)',
        icon: '✓',
      };
    case 'error':
      return {
        border: 'rgba(239, 68, 68, 0.4)',
        bg: 'rgba(239, 68, 68, 0.1)',
        accent: 'var(--color-status-failed)',
        icon: '✕',
      };
    case 'warning':
      return {
        border: 'rgba(255, 181, 1, 0.4)',
        bg: 'rgba(255, 181, 1, 0.1)',
        accent: 'var(--color-status-running)',
        icon: '!',
      };
    case 'info':
    default:
      return {
        border: 'rgba(156, 160, 172, 0.25)',
        bg: 'rgba(156, 160, 172, 0.06)',
        accent: 'var(--color-text-secondary)',
        icon: 'i',
      };
  }
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const s = variantStyles(t.variant);

  return (
    <div
      className="pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-3"
      style={{
        borderColor: s.border,
        background: s.bg,
        backdropFilter: 'blur(12px)',
        animation: 'toast-enter 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      }}
      role="status"
    >
      {/* Icon */}
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: s.accent, color: '#000' }}
        aria-hidden
      >
        {s.icon}
      </span>

      {/* Message */}
      <p
        className="flex-1 text-[13px] leading-snug"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {t.message}
      </p>

      {/* Dismiss */}
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 text-xs transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Dismiss notification"
      >
        ✕
      </button>

      {/* Auto-dismiss progress bar */}
      {t.duration > 0 && (
        <div
          className="absolute bottom-0 left-0 h-[2px] rounded-b-lg"
          style={{
            background: s.accent,
            opacity: 0.5,
            animation: `toast-shrink ${t.duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
