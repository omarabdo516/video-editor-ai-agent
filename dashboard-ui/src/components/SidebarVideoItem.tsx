import { useState } from 'react';
import type { Video } from '../api/types';
import { useDashboardStore } from '../store/useDashboardStore';
import { thumbnailUrl } from '../api/client';

interface Props {
  video: Video;
  isActive: boolean;
  onSelect?: (id: string) => void;
}

function formatDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SidebarVideoItem({ video, isActive, onSelect }: Props) {
  const setActiveVideo = useDashboardStore((s) => s.setActiveVideo);
  const toggleSelect = useDashboardStore((s) => s.toggleSelect);
  const selected = useDashboardStore((s) => s.selectedVideoIds.has(video.id));
  const [thumbError, setThumbError] = useState(false);

  return (
    <div
      className="group flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-all"
      role="button"
      tabIndex={0}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`View ${video.name}`}
      style={{
        borderColor: isActive
          ? 'var(--color-brand-accent)'
          : selected
            ? 'rgba(255, 181, 1, 0.3)'
            : 'transparent',
        background: isActive
          ? 'rgba(255, 181, 1, 0.06)'
          : 'transparent',
      }}
      onClick={() => (onSelect ?? setActiveVideo)(video.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          (onSelect ?? setActiveVideo)(video.id);
        }
      }}
    >
      {/* Thumbnail */}
      <div
        className="shrink-0 overflow-hidden rounded"
        style={{ width: 44, height: 44, background: 'var(--color-bg-elevated)' }}
      >
        {!thumbError ? (
          <img
            src={thumbnailUrl(video.id)}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setThumbError(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            🎬
          </div>
        )}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[12px] font-semibold leading-tight"
          title={video.name}
          style={{
            color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          }}
        >
          {video.name}
        </div>
        <div
          className="mt-1 flex items-center gap-1.5 text-[10px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span>{formatDuration(video.duration_sec)}</span>
          {video.lecturer && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span className="truncate">{video.lecturer}</span>
            </>
          )}
        </div>
      </div>

      {/* Right side: rating + checkbox */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {video.rating != null && (
          <span
            className="text-[11px] font-bold tabular-nums"
            style={{ color: 'var(--color-brand-accent)' }}
          >
            {video.rating}★
          </span>
        )}
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            toggleSelect(video.id);
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 cursor-pointer opacity-40 transition-opacity group-hover:opacity-100"
          style={{ opacity: selected ? 1 : undefined }}
          aria-label={`Select ${video.name}`}
        />
      </div>
    </div>
  );
}
