import { create } from 'zustand';
import type {
  PhaseId,
  PhaseState,
  Video,
  AddVideoInput,
  BulkAddResponse,
} from '../api/types';
import {
  listVideos,
  addVideo as apiAddVideo,
  removeVideo as apiRemoveVideo,
  runPhase as apiRunPhase,
  subscribeToProgress,
  submitRating as apiSubmitRating,
  bulkAddVideos as apiBulkAddVideos,
} from '../api/client';

// Phases that are actually job-spawning POST routes (excludes edit + analyze).
type JobPhase = Exclude<PhaseId, 'edit' | 'analyze'>;

const LOG_BUFFER_LIMIT = 500;

interface DashboardState {
  videos: Video[];
  loading: boolean;
  error: string | null;
  selectedVideoIds: Set<string>;

  // live job subscriptions keyed by jobId → unsubscribe fn
  // (not persisted; used so refresh/unmount can clean up)
  _subscriptions: Map<string, () => void>;

  // jobId → buffered stdout/stderr lines (capped at LOG_BUFFER_LIMIT per job).
  logs: Record<string, string[]>;

  refresh: () => Promise<void>;
  addVideo: (input: AddVideoInput) => Promise<Video>;
  bulkAddVideos: (inputs: AddVideoInput[]) => Promise<BulkAddResponse>;
  removeVideo: (id: string) => Promise<void>;
  runPhase: (videoId: string, phase: JobPhase) => Promise<void>;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  appendLog: (jobId: string, line: string) => void;
  clearLog: (jobId: string) => void;
  submitRating: (videoId: string, rating: number, note?: string) => Promise<void>;
}

function patchVideoPhase(
  videos: Video[],
  videoId: string,
  phase: PhaseId,
  patch: Partial<PhaseState>,
): Video[] {
  return videos.map((v) => {
    if (v.id !== videoId) return v;
    return {
      ...v,
      phases: {
        ...v.phases,
        [phase]: { ...v.phases[phase], ...patch },
      },
    };
  });
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  videos: [],
  loading: false,
  error: null,
  selectedVideoIds: new Set(),
  _subscriptions: new Map(),
  logs: {},

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const videos = await listVideos();
      set({ videos, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  addVideo: async (input) => {
    try {
      const video = await apiAddVideo(input);
      set((s) => ({ videos: [...s.videos, video] }));
      return video;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      throw e;
    }
  },

  bulkAddVideos: async (inputs) => {
    try {
      const resp = await apiBulkAddVideos(inputs);
      if (resp.added.length > 0) {
        set((s) => ({ videos: [...s.videos, ...resp.added] }));
      }
      return resp;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      throw e;
    }
  },

  removeVideo: async (id) => {
    try {
      await apiRemoveVideo(id);
      set((s) => ({
        videos: s.videos.filter((v) => v.id !== id),
        selectedVideoIds: (() => {
          const next = new Set(s.selectedVideoIds);
          next.delete(id);
          return next;
        })(),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      throw e;
    }
  },

  appendLog: (jobId, line) => {
    set((s) => {
      const prev = s.logs[jobId] ?? [];
      const next = prev.length >= LOG_BUFFER_LIMIT ? [...prev.slice(1), line] : [...prev, line];
      return { logs: { ...s.logs, [jobId]: next } };
    });
  },

  clearLog: (jobId) => {
    set((s) => {
      if (!(jobId in s.logs)) return {} as Partial<DashboardState>;
      const next = { ...s.logs };
      delete next[jobId];
      return { logs: next };
    });
  },

  runPhase: async (videoId, phase) => {
    // Optimistic: mark running immediately so the button flips before the
    // network round-trip completes.
    set((s) => ({
      videos: patchVideoPhase(s.videos, videoId, phase, {
        status: 'running',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
      }),
    }));

    let jobId: string;
    try {
      const resp = await apiRunPhase(videoId, phase);
      jobId = resp.jobId;
      set((s) => ({
        videos: patchVideoPhase(s.videos, videoId, phase, {
          lastJobId: jobId,
        }),
        // Start this job's log buffer fresh.
        logs: { ...s.logs, [jobId]: [] },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set((s) => ({
        videos: patchVideoPhase(s.videos, videoId, phase, {
          status: 'failed',
          error: msg,
        }),
        error: msg,
      }));
      return;
    }

    // Subscribe to SSE progress and forward every line into the per-job
    // buffer so LogViewer can tail it.
    const unsubscribe = subscribeToProgress(jobId, (ev) => {
      if (ev.type === 'line') {
        get().appendLog(jobId, ev.text);
      } else if (ev.type === 'done') {
        const finalStatus = ev.exitCode === 0 ? 'done' : 'failed';
        set((s) => {
          const subs = new Map(s._subscriptions);
          subs.delete(jobId);
          return {
            videos: patchVideoPhase(s.videos, videoId, phase, {
              status: finalStatus,
              finishedAt: new Date().toISOString(),
              exitCode: ev.exitCode,
            }),
            _subscriptions: subs,
          };
        });
        // Refetch authoritative state from the API so we pick up outputs, etc.
        void get().refresh();
      } else if (ev.type === 'error') {
        get().appendLog(jobId, `[error] ${ev.message}`);
        set((s) => {
          const subs = new Map(s._subscriptions);
          subs.delete(jobId);
          return {
            videos: patchVideoPhase(s.videos, videoId, phase, {
              status: 'failed',
              finishedAt: new Date().toISOString(),
              error: ev.message,
            }),
            _subscriptions: subs,
          };
        });
      }
    });

    set((s) => {
      const subs = new Map(s._subscriptions);
      subs.set(jobId, unsubscribe);
      return { _subscriptions: subs };
    });
  },

  submitRating: async (videoId, rating, note) => {
    try {
      const resp = await apiSubmitRating(videoId, rating, note);
      set((s) => ({
        videos: s.videos.map((v) => (v.id === videoId ? resp.video : v)),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      throw e;
    }
  },

  toggleSelect: (id) => {
    set((s) => {
      const next = new Set(s.selectedVideoIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedVideoIds: next };
    });
  },

  clearSelection: () => {
    set({ selectedVideoIds: new Set() });
  },

  selectAll: () => {
    set((s) => ({ selectedVideoIds: new Set(s.videos.map((v) => v.id)) }));
  },
}));
