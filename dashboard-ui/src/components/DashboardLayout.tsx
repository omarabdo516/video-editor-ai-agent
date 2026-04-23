import { useMemo, useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { SidebarVideoItem } from './SidebarVideoItem';
import { SidebarControls } from './SidebarControls';
import { VideoDetailPanel } from './VideoDetailPanel';
import { StatsBar } from './StatsBar';
import { EmptyState } from './EmptyState';
import { BatchToolbar } from './BatchToolbar';
import { applyFilters, groupVideos } from '../utils/videoHelpers';

export function DashboardLayout() {
  const videos = useDashboardStore((s) => s.videos);
  const loading = useDashboardStore((s) => s.loading);
  const error = useDashboardStore((s) => s.error);
  const activeVideoId = useDashboardStore((s) => s.activeVideoId);
  const setActiveVideo = useDashboardStore((s) => s.setActiveVideo);
  const selectionCount = useDashboardStore((s) => s.selectedVideoIds.size);
  const filters = useDashboardStore((s) => s.filters);
  const sortField = useDashboardStore((s) => s.sortField);
  const sortDir = useDashboardStore((s) => s.sortDir);
  const groupBy = useDashboardStore((s) => s.groupBy);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const activeVideo = videos.find((v) => v.id === activeVideoId) ?? null;

  // Filter → Group → Sort
  const filtered = useMemo(() => applyFilters(videos, filters), [videos, filters]);
  const groups = useMemo(
    () => groupVideos(filtered, groupBy, sortField, sortDir),
    [filtered, groupBy, sortField, sortDir],
  );

  const isGrouped = groupBy !== 'none';

  // Auto-select first video if none selected
  if (!activeVideo && videos.length > 0 && !activeVideoId) {
    queueMicrotask(() => setActiveVideo(videos[0].id));
  }

  if (loading && videos.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        <span className="spinner mr-2" /> Loading...
      </div>
    );
  }

  if (error && videos.length === 0) {
    return (
      <div className="m-6 rounded-xl border p-4 text-sm" style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)', color: 'var(--color-status-failed)' }}>
        {error}
      </div>
    );
  }

  if (videos.length === 0) {
    return <div className="p-6"><EmptyState /></div>;
  }

  const handleVideoSelect = (id: string) => {
    setActiveVideo(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="relative flex h-full">
      {/* Mobile sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        className="fixed left-3 top-14 z-40 rounded-lg border px-2 py-1.5 text-xs font-bold md:hidden"
        style={{ background: 'var(--color-bg-panel)', borderColor: 'var(--color-border-strong)', color: 'var(--color-brand-accent)' }}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? '✕' : '☰'} {!sidebarOpen && videos.length}
      </button>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className="absolute inset-y-0 left-0 z-30 flex shrink-0 flex-col border-r transition-transform duration-200 md:static md:translate-x-0"
        style={{ width: 300, borderColor: 'var(--color-border-subtle)', background: 'var(--color-bg-panel)', transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        {/* Stats */}
        <div className="border-b px-3 py-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <StatsBar />
        </div>

        {/* Filter + Sort + Group controls */}
        <div className="border-b px-3 py-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <SidebarControls />
        </div>

        {/* Batch toolbar */}
        {selectionCount > 0 && (
          <div className="border-b px-2 py-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <BatchToolbar />
          </div>
        )}

        {/* Video list (flat or grouped) */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <nav className="flex flex-col gap-0.5" aria-label="Video list">
            {groups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.key);

              if (!isGrouped) {
                // Flat list
                return group.videos.map((v) => (
                  <SidebarVideoItem key={v.id} video={v} isActive={v.id === activeVideoId} onSelect={handleVideoSelect} />
                ));
              }

              // Grouped list with collapsible headers
              return (
                <div key={group.key} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(group.key)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
                    style={{ background: 'var(--color-bg-elevated)' }}
                    aria-expanded={!isCollapsed}
                  >
                    <span
                      className="text-[10px] transition-transform"
                      style={{ color: 'var(--color-text-muted)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                      aria-hidden
                    >
                      ▾
                    </span>
                    <span className="flex-1 truncate text-[11px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                      {group.label}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums"
                      style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-muted)' }}
                    >
                      {group.videos.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="mt-0.5 flex flex-col gap-0.5 pl-1">
                      {group.videos.map((v) => (
                        <SidebarVideoItem key={v.id} video={v} isActive={v.id === activeVideoId} onSelect={handleVideoSelect} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && videos.length > 0 && (
              <div className="py-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                No videos match these filters
              </div>
            )}
          </nav>
        </div>

        {/* Sidebar footer */}
        <div
          className="border-t px-3 py-1.5 text-center text-[10px]"
          style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-muted)' }}
        >
          {filtered.length === videos.length
            ? `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`
            : `${filtered.length} of ${videos.length} videos`}
          {isGrouped && ` · ${groups.length} groups`}
        </div>
      </aside>

      {/* ── Main detail area ── */}
      <main className="flex-1 overflow-hidden" style={{ background: 'var(--color-bg-base)' }}>
        {activeVideo ? (
          <VideoDetailPanel video={activeVideo} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
            <span className="text-3xl">←</span>
            <p className="text-sm">Select a video from the sidebar</p>
          </div>
        )}
      </main>
    </div>
  );
}
