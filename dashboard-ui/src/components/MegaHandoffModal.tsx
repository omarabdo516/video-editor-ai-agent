import { useEffect, useState } from 'react';
import { megaHandoffAll } from '../api/client';
import type { MegaHandoffVideo } from '../api/types';

interface Props {
  videoIds: string[];
  onClose: () => void;
}

/**
 * Claude handoff modal for Mode B (Parallel Mega-Batch).
 *
 * Unlike the single-video ClaudeHandoffModal, this one builds one
 * aggregated message that asks Claude to process N videos in the
 * same session. Useful when you've prepped + edited multiple videos
 * and want to hand them all off at once.
 */
export function MegaHandoffModal({ videoIds, onClose }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [videos, setVideos] = useState<MegaHandoffVideo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    megaHandoffAll(videoIds)
      .then((r) => {
        if (cancelled) return;
        setMessage(r.message);
        setVideos(r.videos);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [videoIds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopy = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for older/no-clipboard contexts
      const ta = document.createElement('textarea');
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.7)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl rounded-xl border p-6 shadow-2xl"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-bg-panel)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-brand-accent)' }}>
              🤖 Mega Handoff — {videoIds.length} فيديو
            </h2>
            <div
              className="mt-1 text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Mode B: Claude بيعمل Phase 5/6/6.5 لكل الفيديوهات في session واحدة
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="rounded-md border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              background: 'transparent',
            }}
          >
            ✕
          </button>
        </div>

        {/* Videos summary strip */}
        {videos.length > 0 && (
          <div
            className="mb-3 flex flex-wrap gap-1.5 rounded-lg border p-2"
            style={{
              borderColor: 'var(--color-border-subtle)',
              background: 'var(--color-bg-elevated)',
            }}
          >
            {videos.map((v, idx) => (
              <span
                key={v.id}
                className="rounded px-2 py-1 text-[10px]"
                style={{
                  background: 'var(--color-bg-panel)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
                title={v.path}
              >
                <span style={{ color: 'var(--color-brand-accent)' }}>#{idx + 1}</span>{' '}
                {v.name}
              </span>
            ))}
          </div>
        )}

        {error && (
          <div
            className="mb-3 rounded-md px-3 py-2 text-xs"
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              color: 'var(--color-status-failed)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            {error}
          </div>
        )}

        {!message && !error && (
          <div
            className="py-12 text-center text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ...جاري تحضير الـ handoff message
          </div>
        )}

        {message && (
          <>
            <div
              className="mb-3 overflow-auto rounded-lg border"
              style={{
                borderColor: 'var(--color-border-subtle)',
                background: 'var(--color-bg-base)',
                flex: '1 1 auto',
                minHeight: 200,
                maxHeight: 480,
              }}
            >
              <pre
                className="p-3 text-[11px]"
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--color-text-primary)',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  lineHeight: 1.55,
                  direction: 'rtl',
                }}
              >
                {message}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                اضغط Copy → افتح Claude session جديدة → الصق → Claude هيعمل الـ {videos.length}{' '}
                فيديو بالتتابع
              </div>
              <div className="flex gap-2">
                <a
                  href="https://claude.ai/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border px-3 py-2 text-xs font-medium"
                  style={{
                    borderColor: 'var(--color-border-subtle)',
                    background: 'transparent',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  فتح Claude
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-md px-4 py-2 text-sm font-semibold"
                  style={{
                    background: copied
                      ? 'var(--color-status-done, #10b981)'
                      : 'var(--color-brand-accent)',
                    color: copied ? 'white' : 'var(--color-brand-dark)',
                    minWidth: 160,
                  }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
