import { memo } from 'react';

interface Props {
  progress: number; // 0..1
  label?: string;
  color?: 'accent' | 'success' | 'danger';
}

const COLOR: Record<NonNullable<Props['color']>, string> = {
  accent: 'var(--color-brand-accent)',
  success: 'var(--color-status-done)',
  danger: 'var(--color-status-failed)',
};

export const ProgressBar = memo(function ProgressBar({
  progress,
  label,
  color = 'accent',
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const fill = COLOR[color];
  const pct = Math.round(clamped * 100);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span
          className="text-[10px] tabular-nums"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {label}
        </span>
      )}
      <div
        className="h-1 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--color-bg-elevated)' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `${pct}% complete`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamped * 100}%`,
            background: fill,
            boxShadow: clamped > 0 ? `0 0 6px ${fill}55` : 'none',
            transition: 'width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
});
