import { useEffect } from 'react';
import { VideoList } from './components/VideoList';
import { AddVideoForm } from './components/AddVideoForm';
import { BatchStatus } from './components/BatchStatus';
import { useDashboardStore } from './store/useDashboardStore';
import { useBatchStore } from './store/useBatchStore';

const AUTO_REFRESH_INTERVAL_MS = 5000;

function App() {
  const refresh = useDashboardStore((s) => s.refresh);
  const hasBatch = useBatchStore((s) => s.active !== null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-poll: the dashboard can't directly observe filesystem events
  // from the subtitle editor (which saves via rs-reels' file server on
  // :7777, a different process). Instead we poll the API every 5s
  // while the tab is visible so server-side filesystem detection (e.g.
  // "captions.json was re-saved after edit") shows up naturally. Paused
  // when the tab is hidden to avoid noise.
  useEffect(() => {
    let timer: number | null = null;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    timer = window.setInterval(tick, AUTO_REFRESH_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--color-bg-base)',
        color: 'var(--color-text-primary)',
      }}
    >
      <header
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-brand-accent)' }}>
            RS Reels Dashboard
          </h1>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            phase 11 — session 5
          </span>
        </div>
        <AddVideoForm />
      </header>

      <main className="p-6">
        <VideoList />
      </main>

      {hasBatch && <BatchStatus />}
    </div>
  );
}

export default App;
