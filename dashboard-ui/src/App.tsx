import { useEffect } from 'react';
import { VideoList } from './components/VideoList';
import { AddVideoForm } from './components/AddVideoForm';
import { BatchStatus } from './components/BatchStatus';
import { useDashboardStore } from './store/useDashboardStore';
import { useBatchStore } from './store/useBatchStore';

function App() {
  const refresh = useDashboardStore((s) => s.refresh);
  const hasBatch = useBatchStore((s) => s.active !== null);

  useEffect(() => {
    void refresh();
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
