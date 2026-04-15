import { useEffect, useRef, useState } from 'react';
import type { Video } from '../api/types';
import { getHandoffMessage } from '../api/client';

interface Props {
  video: Video;
  onClose: () => void;
}

export function ClaudeHandoffModal({ video, onClose }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHandoffMessage(video.id)
      .then((r) => {
        if (!cancelled) setMessage(r.message);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [video.id]);

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
      style={{ background: 'rgba(0, 0, 0, 0.65)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-xl border p-5 shadow-2xl"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-bg-panel)',
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              className="text-lg font-bold"
              style={{ color: 'var(--color-brand-accent)' }}
            >
              🤖 Claude Handoff — Phase 5/6 Analysis
            </h2>
            <p
              className="mt-1 truncate text-xs"
              style={{ color: 'var(--color-text-muted)' }}
              title={video.name}
            >
              {video.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
            }}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <p
          className="mb-2 text-xs leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          انسخ الرسالة دي والصقها في Claude session جديدة. الـ Dashboard مش
          بيستدعي Claude مباشرة — ده copy-paste bridge.
        </p>

        <div
          className="mb-3 rounded-md border"
          style={{
            borderColor: 'var(--color-border-subtle)',
            background: 'var(--color-bg-base)',
          }}
        >
          {error ? (
            <div
              className="p-3 text-xs"
              style={{ color: 'var(--color-status-failed)' }}
            >
              {error}
            </div>
          ) : message == null ? (
            <div
              className="p-3 text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              جاري تحميل الرسالة...
            </div>
          ) : (
            <pre
              ref={preRef}
              className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-3 font-mono"
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '11px',
                direction: 'ltr',
                textAlign: 'left',
              }}
            >
              {message}
            </pre>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            فتح Claude session جديدة ↗
          </a>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
              }}
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!message}
              className="rounded-md px-4 py-2 text-sm font-semibold"
              style={{
                background: 'var(--color-brand-accent)',
                color: 'var(--color-brand-dark)',
              }}
            >
              {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
