import type { PhaseStatus } from '../api/types';

interface Props {
  status: PhaseStatus;
  label?: string;
}

const LABELS: Record<PhaseStatus, string> = {
  pending: 'pending',
  running: 'running',
  done: 'done',
  failed: 'failed',
};

const COLORS: Record<PhaseStatus, { bg: string; fg: string; border: string }> = {
  pending: {
    bg: 'rgba(107, 114, 128, 0.12)',
    fg: 'var(--color-text-secondary)',
    border: 'var(--color-border-subtle)',
  },
  running: {
    bg: 'rgba(255, 181, 1, 0.14)',
    fg: 'var(--color-status-running)',
    border: 'rgba(255, 181, 1, 0.35)',
  },
  done: {
    bg: 'rgba(16, 185, 129, 0.14)',
    fg: 'var(--color-status-done)',
    border: 'rgba(16, 185, 129, 0.35)',
  },
  failed: {
    bg: 'rgba(239, 68, 68, 0.14)',
    fg: 'var(--color-status-failed)',
    border: 'rgba(239, 68, 68, 0.35)',
  },
};

export function StatusPill({ status, label }: Props) {
  const colors = COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: colors.bg,
        color: colors.fg,
        border: `1px solid ${colors.border}`,
      }}
    >
      {status === 'running' && <span className="spinner" />}
      {status === 'done' && <span aria-hidden>✓</span>}
      {status === 'failed' && <span aria-hidden>✗</span>}
      {label ?? LABELS[status]}
    </span>
  );
}
