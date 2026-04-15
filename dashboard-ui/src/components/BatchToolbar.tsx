import { useState } from 'react';
import type { BatchPhase } from '../api/types';
import { useDashboardStore } from '../store/useDashboardStore';
import { useBatchStore } from '../store/useBatchStore';

const PHASE_LABELS: Record<BatchPhase, string> = {
  phase1: 'Phase 1',
  transcribe: 'Transcribe',
  microEvents: 'Micro Events',
  render: 'Render',
};

const PHASE_OPTIONS: BatchPhase[] = [
  'phase1',
  'transcribe',
  'microEvents',
  'render',
];

export function BatchToolbar() {
  const selectedIds = useDashboardStore((s) => s.selectedVideoIds);
  const clearSelection = useDashboardStore((s) => s.clearSelection);
  const selectAll = useDashboardStore((s) => s.selectAll);
  const totalVideos = useDashboardStore((s) => s.videos.length);
  const activeBatch = useBatchStore((s) => s.active);
  const startBatch = useBatchStore((s) => s.startBatch);

  const [phase, setPhase] = useState<BatchPhase>('phase1');
  const [continueOnError, setContinueOnError] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const count = selectedIds.size;
  if (count === 0) return null;

  const batchRunning = activeBatch?.status === 'running';

  const handleRun = async () => {
    const ids = [...selectedIds];
    const ok = confirm(
      `Run ${PHASE_LABELS[phase]} on ${ids.length} videos? They'll process one at a time.`,
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      await startBatch(phase, ids, continueOnError);
      clearSelection();
    } catch (e) {
      alert(
        `Failed to start batch: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-lg"
      style={{
        borderColor: 'var(--color-brand-accent)',
        background: 'var(--color-bg-panel)',
        boxShadow: '0 4px 20px rgba(255, 181, 1, 0.15)',
      }}
    >
      <span
        className="text-sm font-bold"
        style={{ color: 'var(--color-brand-accent)' }}
      >
        {count} {count === 1 ? 'video' : 'videos'} selected
      </span>

      <span
        className="h-5 w-px"
        style={{ background: 'var(--color-border-subtle)' }}
      />

      <label
        className="flex items-center gap-2 text-xs"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Phase:
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as BatchPhase)}
          disabled={batchRunning || submitting}
          className="rounded-md border px-2 py-1 text-xs"
          style={{
            borderColor: 'var(--color-border-subtle)',
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-text-primary)',
          }}
        >
          {PHASE_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {PHASE_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      <label
        className="flex items-center gap-1.5 text-xs"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <input
          type="checkbox"
          checked={continueOnError}
          onChange={(e) => setContinueOnError(e.target.checked)}
          disabled={batchRunning || submitting}
        />
        Continue on error
      </label>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => selectAll()}
        disabled={count === totalVideos}
        className="rounded-md px-2 py-1 text-xs"
        style={{
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border-subtle)',
          background: 'transparent',
        }}
      >
        Select all
      </button>

      <button
        type="button"
        onClick={() => clearSelection()}
        className="rounded-md px-2 py-1 text-xs"
        style={{
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border-subtle)',
          background: 'transparent',
        }}
      >
        Clear
      </button>

      <button
        type="button"
        onClick={handleRun}
        disabled={batchRunning || submitting}
        className="rounded-lg px-4 py-2 text-sm font-bold"
        style={{
          background: 'var(--color-brand-accent)',
          color: '#000',
          opacity: batchRunning || submitting ? 0.55 : 1,
          cursor: batchRunning || submitting ? 'not-allowed' : 'pointer',
        }}
        title={
          batchRunning
            ? 'A batch is already running — wait for it to finish or cancel it'
            : undefined
        }
      >
        {submitting ? 'Starting…' : `▶ Run on ${count}`}
      </button>
    </div>
  );
}
