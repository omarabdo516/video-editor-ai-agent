import { useEffect, useRef } from 'react';
import { useBatchStore } from '../store/useBatchStore';
import { useDashboardStore } from '../store/useDashboardStore';
import { ProgressBar } from './ProgressBar';

const PHASE_LABEL: Record<string, string> = {
  phase1: 'Phase 1',
  transcribe: 'Transcribe',
  microEvents: 'Micro Events',
  render: 'Render',
};

export function BatchStatus() {
  const active = useBatchStore((s) => s.active);
  const cancelBatch = useBatchStore((s) => s.cancelBatch);
  const clearBatch = useBatchStore((s) => s.clearBatch);
  const videos = useDashboardStore((s) => s.videos);

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    // Only auto-scroll if user hasn't scrolled up.
    const stuckToBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (stuckToBottom) el.scrollTop = el.scrollHeight;
  }, [active?.log.length]);

  if (!active) return null;

  const running = active.status === 'running';
  const done = active.status === 'done';
  const failed = active.status === 'failed';
  const cancelled = active.status === 'cancelled';

  const nameFor = (videoId: string): string => {
    const v = videos.find((x) => x.id === videoId);
    return v?.name ?? videoId;
  };

  const completedCount = active.results.filter(
    (r) => r.status === 'done' || r.status === 'failed',
  ).length;
  const progressFrac = active.total > 0 ? completedCount / active.total : 0;

  const headline = running
    ? `Processing ${active.currentIndex + 1}/${active.total}${
        active.currentVideoId ? ` — ${nameFor(active.currentVideoId)}` : ''
      }`
    : done
    ? `Done — ${active.total} videos processed`
    : failed
    ? `Failed — ${active.error ?? 'unknown error'}`
    : cancelled
    ? 'Cancelled'
    : active.status;

  const statusColor = failed
    ? 'var(--color-status-failed)'
    : done
    ? 'var(--color-status-done)'
    : cancelled
    ? 'var(--color-text-muted)'
    : 'var(--color-brand-accent)';

  return (
    <aside
      className="fixed bottom-4 right-4 z-30 flex w-96 max-w-[90vw] flex-col gap-2 rounded-xl border p-4 shadow-2xl"
      style={{
        borderColor: 'var(--color-border-subtle)',
        background: 'var(--color-bg-panel)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.55)',
      }}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Batch · {PHASE_LABEL[active.phase] ?? active.phase}
          </div>
          <div
            className="truncate text-sm font-bold"
            style={{ color: statusColor }}
            title={headline}
          >
            {headline}
          </div>
        </div>
        {!running && (
          <button
            type="button"
            onClick={clearBatch}
            className="rounded-md px-2 py-1 text-xs"
            style={{
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
              background: 'transparent',
            }}
            title="Dismiss"
          >
            ×
          </button>
        )}
      </header>

      <ProgressBar
        progress={progressFrac}
        color={failed ? 'danger' : done ? 'success' : 'accent'}
      />

      <div
        ref={logRef}
        className="max-h-40 overflow-y-auto rounded-md px-2 py-1.5 font-mono text-[10px] leading-tight"
        style={{
          background: 'var(--color-bg-base)',
          border: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {active.log.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)' }}>waiting for events…</div>
        ) : (
          active.log.map((line, i) => (
            <div
              key={i}
              style={{
                color:
                  line.kind === 'success'
                    ? 'var(--color-status-done)'
                    : line.kind === 'error'
                    ? 'var(--color-status-failed)'
                    : 'var(--color-text-secondary)',
              }}
            >
              {line.text}
            </div>
          ))
        )}
      </div>

      {running && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void cancelBatch()}
            disabled={active.status !== 'running'}
            className="rounded-md px-3 py-1.5 text-xs font-semibold"
            style={{
              color: 'var(--color-status-failed)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              background: 'rgba(239, 68, 68, 0.08)',
            }}
          >
            Cancel batch
          </button>
        </div>
      )}
    </aside>
  );
}
