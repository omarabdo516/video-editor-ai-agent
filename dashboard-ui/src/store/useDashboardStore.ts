import { create } from 'zustand';
import type {
  PhaseId,
  PhaseState,
  Video,
  AddVideoInput,
  BulkAddResponse,
  MegaCommitResponse,
} from '../api/types';
import {
  listVideos,
  addVideo as apiAddVideo,
  removeVideo as apiRemoveVideo,
  runPhase as apiRunPhase,
  subscribeToProgress,
  submitRating as apiSubmitRating,
  bulkAddVideos as apiBulkAddVideos,
  megaCommitBatch as apiMegaCommitBatch,
  updateVideo as apiUpdateVideo,
} from '../api/client';
import { toast } from './useToastStore';

// Phases that are actually job-spawning POST routes (excludes edit + analyze).
type JobPhase = Exclude<PhaseId, 'edit' | 'analyze'>;

const LOG_BUFFER_LIMIT = 500;

// Tracks in-flight runPhase calls to prevent double-click spawning duplicate jobs.
// Each entry stores a timeout that auto-clears after 10 minutes as a safety valve
// in case the SSE connection drops without emitting done/error.
const _inflight = new Map<string, ReturnType<typeof setTimeout>>();
const INFLIGHT_TIMEOUT_MS = 10 * 60 * 1000;
function inflightKey(videoId: string, phase: string) {
  return `${videoId}:${phase}`;
}
function inflightAdd(key: string) {
  inflightRemove(key);
  const timer = setTimeout(() => _inflight.delete(key), INFLIGHT_TIMEOUT_MS);
  _inflight.set(key, timer);
}
function inflightRemove(key: string) {
  const existing = _inflight.get(key);
  if (existing !== undefined) {
    clearTimeout(existing);
    inflightRemove(key);
  }
}

export type SortField = 'name' | 'addedAt' | 'rating' | 'duration' | 'progress';
export type SortDir = 'asc' | 'desc';
export type GroupField = 'none' | 'lecturer' | 'workshop' | 'category' | 'status';
export type StatusFilter = 'all' | 'pending' | 'in_progress' | 'done' | 'rated';

export interface Filters {
  status: StatusFilter;
  lecturer: string | null;
  workshop: string | null;
  category: string | null;
}

interface DashboardState {
  videos: Video[];
  loading: boolean;
  error: string | null;
  selectedVideoIds: Set<string>;
  /** The video currently shown in the detail panel (sidebar layout). */
  activeVideoId: string | null;
  setActiveVideo: (id: string | null) => void;

  /** Filter + sort + group */
  filters: Filters;
  sortField: SortField;
  sortDir: SortDir;
  groupBy: GroupField;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  clearFilters: () => void;
  setSortField: (field: SortField) => void;
  toggleSortDir: () => void;
  setGroupBy: (field: GroupField) => void;
  updateVideoMeta: (id: string, patch: { category?: string | null; name?: string; lecturer?: string; workshop?: string }) => Promise<void>;

  // live job subscriptions keyed by jobId → unsubscribe fn
  // (not persisted; used so refresh/unmount can clean up)
  _subscriptions: Map<string, () => void>;

  // jobId → buffered stdout/stderr lines (capped at LOG_BUFFER_LIMIT per job).
  logs: Record<string, string[]>;

  refresh: () => Promise<void>;
  addVideo: (input: AddVideoInput) => Promise<Video>;
  bulkAddVideos: (inputs: AddVideoInput[]) => Promise<BulkAddResponse>;
  megaCommitBatch: (
    videoIds: string[],
    batchNote?: string,
  ) => Promise<MegaCommitResponse>;
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
  activeVideoId: null,
  setActiveVideo: (id) => set({ activeVideoId: id }),
  filters: { status: 'all', lecturer: null, workshop: null, category: null },
  sortField: 'addedAt',
  sortDir: 'desc',
  groupBy: 'none',
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  clearFilters: () =>
    set({ filters: { status: 'all', lecturer: null, workshop: null, category: null } }),
  setSortField: (field) => set((s) => ({
    sortField: field,
    sortDir: field === s.sortField ? s.sortDir : (field === 'name' ? 'asc' : 'desc'),
  })),
  toggleSortDir: () => set((s) => ({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' })),
  setGroupBy: (field) => set({ groupBy: field }),
  updateVideoMeta: async (id, patch) => {
    try {
      const updated = await apiUpdateVideo(id, patch);
      set((s) => ({
        videos: s.videos.map((v) => (v.id === id ? updated : v)),
      }));
      toast.success('Video updated');
    } catch (e) {
      toast.error(`Update failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
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
      toast.success(`Added "${video.name}"`);
      return video;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      toast.error(`Failed to add video: ${msg}`);
      throw e;
    }
  },

  bulkAddVideos: async (inputs) => {
    try {
      const resp = await apiBulkAddVideos(inputs);
      if (resp.added.length > 0) {
        set((s) => ({ videos: [...s.videos, ...resp.added] }));
        toast.success(`Added ${resp.added.length} videos`);
      }
      if (resp.errors.length > 0) {
        toast.warning(`${resp.errors.length} videos failed to add`);
      }
      return resp;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      toast.error(`Bulk add failed: ${msg}`);
      throw e;
    }
  },

  megaCommitBatch: async (videoIds, batchNote) => {
    try {
      const resp = await apiMegaCommitBatch(videoIds, batchNote);
      // A successful commit upserts feedback/log.json + CLAUDE.md on
      // disk but doesn't touch our in-memory video state — refresh to
      // keep things consistent.
      void get().refresh();
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
        activeVideoId: s.activeVideoId === id ? null : s.activeVideoId,
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
    // Prevent duplicate spawns from rapid clicks
    const key = inflightKey(videoId, phase);
    if (_inflight.has(key) /* already running */) {
      toast.info('Phase already running');
      return;
    }
    inflightAdd(key);

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
      inflightRemove(key);
      return;
    }

    // Subscribe to SSE progress and forward every line into the per-job
    // buffer so LogViewer can tail it.
    const phaseLabels: Record<string, string> = {
      phase1: 'Phase 1',
      transcribe: 'Transcribe',
      microEvents: 'Micro Events',
      render: 'Render',
    };
    const videoName = get().videos.find((v) => v.id === videoId)?.name ?? videoId;
    const phaseLabel = phaseLabels[phase] ?? phase;

    const unsubscribe = subscribeToProgress(jobId, (ev) => {
      if (ev.type === 'line') {
        get().appendLog(jobId, ev.text);
      } else if (ev.type === 'done') {
        inflightRemove(key);
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
        if (ev.exitCode === 0) {
          toast.success(`${phaseLabel} done — ${videoName}`);
        } else {
          toast.error(`${phaseLabel} failed — ${videoName}`);
        }
        // Refetch authoritative state from the API so we pick up outputs, etc.
        void get().refresh();
      } else if (ev.type === 'error') {
        inflightRemove(key);
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
        toast.error(`${phaseLabel} error — ${videoName}`);
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
      toast.success(`Rating saved — ${rating}/5`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      toast.error(`Rating failed: ${msg}`);
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
