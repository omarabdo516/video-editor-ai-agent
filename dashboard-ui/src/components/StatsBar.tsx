import { memo } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

export const StatsBar = memo(function StatsBar() {
  const videos = useDashboardStore((s) => s.videos);

  const total = videos.length;
  const done = videos.filter((v) => v.phases.render?.status === 'done').length;
  const running = videos.filter((v) =>
    Object.values(v.phases).some((p) => p.status === 'running'),
  ).length;
  const rated = videos.filter((v) => v.rating != null).length;
  const avgRating =
    rated > 0
      ? (
          videos
            .filter((v) => v.rating != null)
            .reduce((sum, v) => sum + (v.rating ?? 0), 0) / rated
        ).toFixed(1)
      : '—';

  return (
    <div className="flex items-center gap-3">
      <StatItem value={total} label="Total" color="var(--color-text-primary)" />
      <Divider />
      <StatItem value={running} label="Active" color="var(--color-status-running)" />
      <Divider />
      <StatItem value={done} label="Done" color="var(--color-status-done)" />
      <Divider />
      <StatItem value={avgRating} label="Rating" color="var(--color-brand-accent)" />
    </div>
  );
});

function StatItem({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span
        className="text-sm font-bold tabular-nums leading-none"
        style={{ color }}
      >
        {value}
      </span>
      <span
        className="text-[9px] uppercase tracking-wider leading-none"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <span
      className="h-3 w-px"
      style={{ background: 'var(--color-border-subtle)' }}
    />
  );
}
