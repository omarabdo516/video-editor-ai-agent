import { useDashboardStore } from '../store/useDashboardStore';
import { VideoCard } from './VideoCard';
import { EmptyState } from './EmptyState';
import { BatchToolbar } from './BatchToolbar';

export function VideoList() {
  const videos = useDashboardStore((s) => s.videos);
  const loading = useDashboardStore((s) => s.loading);
  const error = useDashboardStore((s) => s.error);
  const selectionCount = useDashboardStore((s) => s.selectedVideoIds.size);

  if (loading && videos.length === 0) {
    return (
      <div className="text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        جاري التحميل...
      </div>
    );
  }

  if (error && videos.length === 0) {
    return (
      <div
        className="rounded-xl border p-4 text-sm"
        style={{
          borderColor: 'rgba(239, 68, 68, 0.35)',
          background: 'rgba(239, 68, 68, 0.08)',
          color: 'var(--color-status-failed)',
        }}
      >
        {error}
      </div>
    );
  }

  if (videos.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col">
      {selectionCount > 0 && <BatchToolbar />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
    </div>
  );
}
