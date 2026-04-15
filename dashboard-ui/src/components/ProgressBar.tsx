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

export function ProgressBar({ progress, label, color = 'accent' }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const fill = COLOR[color];

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
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${clamped * 100}%`,
            background: fill,
            boxShadow: `0 0 8px ${fill}66`,
          }}
        />
      </div>
    </div>
  );
}
