import { useEffect } from 'react';
import { SHORTCUT_GROUPS } from '../hooks/useKeyboardShortcuts';

interface Props {
  onClose: () => void;
}

export function ShortcutsHelp({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col gap-5 rounded-xl border p-6 shadow-2xl"
        style={{
          background: 'var(--color-bg-panel)',
          borderColor: 'var(--color-border-strong)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3
            className="text-base font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Keyboard Shortcuts
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs"
            style={{
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            ESC
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h4
                className="mb-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {group.title}
              </h4>
              <div className="flex flex-col gap-1">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.keys}
                    className="flex items-center justify-between rounded px-2 py-1.5"
                    style={{ background: 'var(--color-bg-elevated)' }}
                  >
                    <span
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {s.description}
                    </span>
                    <kbd
                      className="rounded border px-2 py-0.5 font-mono text-xs"
                      style={{
                        borderColor: 'var(--color-border-strong)',
                        background: 'var(--color-bg-base)',
                        color: 'var(--color-brand-accent)',
                      }}
                    >
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p
          className="text-center text-[10px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Shortcuts are disabled when typing in inputs
        </p>
      </div>
    </div>
  );
}
