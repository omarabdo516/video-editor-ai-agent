import { useCallback, useEffect, useMemo, useState } from 'react';
import { AddVideoForm } from './components/AddVideoForm';
import { DashboardLayout } from './components/DashboardLayout';
import { BatchStatus } from './components/BatchStatus';
import { ConfirmModal, AlertModal, PromptModal } from './components/ConfirmModal';
import { ToastContainer } from './components/ToastContainer';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { useDashboardStore } from './store/useDashboardStore';
import { useBatchStore } from './store/useBatchStore';
import { usePlanStore } from './store/usePlanStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { toast } from './store/useToastStore';
import { getEditHandoff } from './api/client';

const AUTO_REFRESH_INTERVAL_MS = 5000;

function App() {
  const refresh = useDashboardStore((s) => s.refresh);
  const hasBatch = useBatchStore((s) => s.active !== null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    // First mount — fetch videos, then re-attach to any plan/render jobs
    // that were running when the page reloaded (S1.5 session-resume).
    void (async () => {
      await refresh();
      const videos = useDashboardStore.getState().videos;
      usePlanStore.getState().resumeFromVideos(videos);
    })();
  }, [refresh]);

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

  // ─── Keyboard shortcut handlers ───
  const handlePhase = useCallback(
    (phase: 'phase1' | 'transcribe' | 'edit' | 'analyze' | 'microEvents' | 'render') => {
      const store = useDashboardStore.getState();
      const vid = store.activeVideoId;
      if (!vid) return;

      // Edit and Analyze have custom handlers
      if (phase === 'edit') {
        void (async () => {
          try {
            const handoff = await getEditHandoff(vid);
            if (handoff.ready) {
              window.open(handoff.editorUrl, '_blank', 'noopener,noreferrer');
            } else {
              toast.error('Editor not ready — try the Edit button');
            }
          } catch {
            toast.error('Edit handoff failed');
          }
        })();
        return;
      }
      if (phase === 'analyze') {
        // Can't easily open the modal from here — nudge user
        toast.info('Use the "Send to Claude" button in the detail panel');
        return;
      }
      // Check if already running
      const video = store.videos.find((v) => v.id === vid);
      if (!video) return;
      const status = video.phases[phase]?.status;
      if (status === 'running') return;
      void store.runPhase(vid, phase);
    },
    [],
  );

  const handleAutoPrep = useCallback(() => {
    // Dispatch a custom event that VideoDetailPanel listens for
    window.dispatchEvent(new CustomEvent('dashboard:auto-prep'));
  }, []);

  const handleAutoFinish = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dashboard:auto-finish'));
  }, []);

  const shortcutActions = useMemo(
    () => ({
      onToggleHelp: () => setHelpOpen((v) => !v),
      onPhase: handlePhase,
      onAutoPrep: handleAutoPrep,
      onAutoFinish: handleAutoFinish,
    }),
    [handlePhase, handleAutoPrep, handleAutoFinish],
  );

  useKeyboardShortcuts(shortcutActions);

  return (
    <div
      className="flex h-screen flex-col"
      style={{
        background: 'var(--color-bg-base)',
        color: 'var(--color-text-primary)',
      }}
    >
      {/* Header */}
      <header
        className="flex shrink-0 items-center justify-between border-b px-5 py-3"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-brand-accent)' }}>
            RS Reels Dashboard
          </h1>
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            v2
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="rounded-md px-2 py-1 text-xs"
            style={{
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border-subtle)',
              background: 'transparent',
            }}
            title="Keyboard shortcuts (?)"
          >
            <kbd className="font-mono">?</kbd> Shortcuts
          </button>
          <AddVideoForm />
        </div>
      </header>

      {/* Main content: sidebar + detail */}
      <div className="flex-1 overflow-hidden">
        <DashboardLayout />
      </div>

      {hasBatch && <BatchStatus />}

      {/* Global modals + toasts */}
      <ConfirmModal />
      <AlertModal />
      <PromptModal />
      <ToastContainer />
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

export default App;
