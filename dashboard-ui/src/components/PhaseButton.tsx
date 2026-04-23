import type { PhaseId, PhaseState, Video } from '../api/types';
import { useDashboardStore } from '../store/useDashboardStore';
import { useModalStore } from '../store/useModalStore';

interface Props {
  video: Video;
  phase: PhaseId;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
}

const BASE_CLASSES =
  'flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-right transition-colors min-w-[108px]';

function statusStyle(status: PhaseState['status']): {
  border: string;
  bg: string;
  fg: string;
  hover: string;
} {
  switch (status) {
    case 'running':
      return {
        border: 'rgba(255, 181, 1, 0.45)',
        bg: 'rgba(255, 181, 1, 0.08)',
        fg: 'var(--color-status-running)',
        hover: 'rgba(255, 181, 1, 0.14)',
      };
    case 'done':
      return {
        border: 'rgba(16, 185, 129, 0.45)',
        bg: 'rgba(16, 185, 129, 0.08)',
        fg: 'var(--color-status-done)',
        hover: 'rgba(16, 185, 129, 0.14)',
      };
    case 'failed':
      return {
        border: 'rgba(239, 68, 68, 0.45)',
        bg: 'rgba(239, 68, 68, 0.08)',
        fg: 'var(--color-status-failed)',
        hover: 'rgba(239, 68, 68, 0.14)',
      };
    default:
      return {
        border: 'var(--color-border-subtle)',
        bg: 'var(--color-bg-elevated)',
        fg: 'var(--color-text-primary)',
        hover: 'var(--color-bg-panel)',
      };
  }
}

export function PhaseButton({
  video,
  phase,
  label,
  disabled,
  disabledReason,
  onClick,
}: Props) {
  const runPhase = useDashboardStore((s) => s.runPhase);
  const showConfirm = useModalStore((s) => s.showConfirm);
  const state = video.phases[phase] ?? { status: 'pending' };
  const style = statusStyle(state.status);
  const isRunning = state.status === 'running';

  const handleClick = async () => {
    if (onClick) {
      onClick();
      return;
    }
    if (isRunning) return;
    if (phase === 'edit' || phase === 'analyze') return;

    if (state.status === 'done') {
      const ok = await showConfirm({
        title: `Re-run ${label}?`,
        message: `This phase already completed. Running it again will overwrite the previous output.`,
        confirmLabel: 'Re-run',
      });
      if (!ok) return;
    }
    void runPhase(video.id, phase);
  };

  const isDisabled = disabled || isRunning;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={handleClick}
      title={disabled ? disabledReason : state.error ?? undefined}
      className={`${BASE_CLASSES} phase-btn`}
      style={{
        borderColor: style.border,
        background: style.bg,
        color: style.fg,
        '--phase-btn-hover': style.hover,
      } as React.CSSProperties}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-1.5 text-xs opacity-80">
        {isRunning && <span className="spinner" />}
        {state.status === 'done' && <span aria-hidden>✓</span>}
        {state.status === 'failed' && <span aria-hidden>✗</span>}
        {state.status}
      </span>
    </button>
  );
}
