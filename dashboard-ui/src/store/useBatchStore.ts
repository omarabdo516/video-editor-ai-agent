import { create } from 'zustand';
import type {
  BatchPhase,
  BatchResult,
  BatchSnapshot,
  BatchStatus,
} from '../api/types';
import {
  startBatch as apiStartBatch,
  cancelBatch as apiCancelBatch,
  subscribeToBatch as apiSubscribeToBatch,
} from '../api/client';
import { useDashboardStore } from './useDashboardStore';
import { toast } from './useToastStore';

const LOG_LIMIT = 200;

interface BatchLogLine {
  text: string;
  kind: 'info' | 'success' | 'error';
}

interface ActiveBatch {
  id: string;
  phase: BatchPhase;
  videoIds: string[];
  currentIndex: number;
  total: number;
  status: BatchStatus;
  results: BatchResult[];
  currentVideoId: string | null;
  error: string | null;
  log: BatchLogLine[];
  startedAt: string;
}

interface BatchState {
  active: ActiveBatch | null;
  _unsubscribe: (() => void) | null;

  startBatch: (
    phase: BatchPhase,
    videoIds: string[],
    continueOnError: boolean,
  ) => Promise<void>;
  cancelBatch: () => Promise<void>;
  clearBatch: () => void;
}

function snapshotToActive(snap: BatchSnapshot): ActiveBatch {
  return {
    id: snap.id,
    phase: snap.phase,
    videoIds: snap.videoIds,
    currentIndex: snap.currentIndex,
    total: snap.total,
    status: snap.status,
    results: snap.results,
    currentVideoId: snap.videoIds[snap.currentIndex] ?? null,
    error: snap.error ?? null,
    log: [],
    startedAt: snap.startedAt,
  };
}

function pushLog(active: ActiveBatch, line: BatchLogLine): ActiveBatch {
  const next = [...active.log, line];
  if (next.length > LOG_LIMIT) next.splice(0, next.length - LOG_LIMIT);
  return { ...active, log: next };
}

function patchResult(
  active: ActiveBatch,
  index: number,
  patch: Partial<BatchResult>,
): ActiveBatch {
  const results = active.results.map((r, i) =>
    i === index ? { ...r, ...patch } : r,
  );
  return { ...active, results };
}

export const useBatchStore = create<BatchState>((set, get) => ({
  active: null,
  _unsubscribe: null,

  startBatch: async (phase, videoIds, continueOnError) => {
    // Tear down any previous subscription before starting a new batch.
    const prev = get()._unsubscribe;
    if (prev) prev();

    const snap = await apiStartBatch(phase, videoIds, continueOnError);
    set({ active: snapshotToActive(snap) });

    const unsub = apiSubscribeToBatch(snap.batchId, (ev) => {
      const cur = get().active;
      if (!cur || cur.id !== ev.batchId) return;

      if (ev.type === 'start') {
        set({
          active: pushLog(cur, {
            text: `Batch started — ${ev.total} videos, phase: ${ev.phase}`,
            kind: 'info',
          }),
        });
      } else if (ev.type === 'progress') {
        set({
          active: {
            ...pushLog(cur, {
              text: `(${ev.currentIndex + 1}/${ev.total}) processing ${nameFor(ev.currentVideoId)}`,
              kind: 'info',
            }),
            currentIndex: ev.currentIndex,
            total: ev.total,
            currentVideoId: ev.currentVideoId,
          },
        });
        // Pull the latest video state from the server so per-card phase
        // buttons tick to 'running' as the batch moves through them.
        void useDashboardStore.getState().refresh();
      } else if (ev.type === 'video-done') {
        const patched = patchResult(cur, ev.index, {
          status: ev.status,
          jobId: ev.jobId,
          error: ev.error,
        });
        const kind = ev.status === 'done' ? 'success' : 'error';
        const mark = ev.status === 'done' ? '✓' : '✗';
        set({
          active: pushLog(patched, {
            text: `${mark} ${nameFor(ev.videoId)}${ev.error ? ` — ${ev.error}` : ''}`,
            kind,
          }),
        });
        void useDashboardStore.getState().refresh();
      } else if (ev.type === 'cancel-requested') {
        set({
          active: pushLog(cur, {
            text: 'cancellation requested — finishing current video…',
            kind: 'info',
          }),
        });
      } else if (ev.type === 'done') {
        const doneCount = ev.results.filter((r) => r.status === 'done').length;
        const failCount = ev.results.filter((r) => r.status === 'failed').length;
        set({
          active: {
            ...pushLog(cur, { text: 'Batch complete.', kind: 'success' }),
            status: 'done',
            results: ev.results,
          },
          _unsubscribe: null,
        });
        toast.success(
          `Batch done — ${doneCount} succeeded${failCount > 0 ? `, ${failCount} failed` : ''}`,
        );
        void useDashboardStore.getState().refresh();
      } else if (ev.type === 'failed') {
        set({
          active: {
            ...pushLog(cur, {
              text: `Batch failed: ${ev.error}`,
              kind: 'error',
            }),
            status: 'failed',
            error: ev.error,
          },
          _unsubscribe: null,
        });
        toast.error(`Batch failed: ${ev.error}`);
        void useDashboardStore.getState().refresh();
      } else if (ev.type === 'cancelled') {
        set({
          active: {
            ...pushLog(cur, { text: 'Batch cancelled.', kind: 'info' }),
            status: 'cancelled',
          },
          _unsubscribe: null,
        });
        toast.warning('Batch cancelled');
        void useDashboardStore.getState().refresh();
      }
    });

    set({ _unsubscribe: unsub });
  },

  cancelBatch: async () => {
    const cur = get().active;
    if (!cur) return;
    try {
      await apiCancelBatch(cur.id);
    } catch {
      toast.error('فشل إلغاء الـ Batch');
    }
  },

  clearBatch: () => {
    const unsub = get()._unsubscribe;
    if (unsub) unsub();
    set({ active: null, _unsubscribe: null });
  },
}));

function nameFor(videoId: string): string {
  const v = useDashboardStore
    .getState()
    .videos.find((x) => x.id === videoId);
  return v?.name ?? videoId;
}
