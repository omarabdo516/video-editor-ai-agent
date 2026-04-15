// Mirrors the shape produced by dashboard-api/lib/state.mjs.
// Keep in sync manually — the API is .mjs (no shared types).

export type PhaseId =
  | 'phase1'
  | 'transcribe'
  | 'edit'
  | 'analyze'
  | 'microEvents'
  | 'render';

export type PhaseStatus = 'pending' | 'running' | 'done' | 'failed';

export interface PhaseState {
  status: PhaseStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastJobId?: string | null;
  exitCode?: number | null;
  error?: string | null;
}

export interface VideoOutputs {
  raw_captions?: string;
  captions?: string;
  animation_plan?: string;
  reel?: string;
  [key: string]: string | undefined;
}

export interface Video {
  id: string;
  path: string;
  name: string;
  lecturer: string | null;
  workshop: string | null;
  addedAt: string;
  duration_sec: number | null;
  phases: Record<PhaseId, PhaseState>;
  outputs: VideoOutputs;
  rating: number | null;
  notes: string | null;
}

export interface JobStartResponse {
  jobId: string;
  status: 'running';
  phase: PhaseId;
  videoId: string;
  cmd: string;
  args: string[];
}

export interface EditHandoffResponse {
  editorUrl: string;
  scaledReady: boolean;
  captionsReady: boolean;
  /** True when the Vite dev server responded to a TCP probe before the API returned. */
  ready?: boolean;
  /** True when the API reused an already-running editor session (same video). */
  reused?: boolean;
  filePort?: number;
  editorPort?: number;
  hintCommand: string;
  note: string;
}

export type ProgressEvent =
  | { type: 'line'; text: string }
  | { type: 'done'; exitCode: number; status?: string }
  | { type: 'error'; message: string };

export interface AddVideoInput {
  path: string;
  name?: string;
  lecturer?: string;
  workshop?: string;
}

// ─── Folder scan + bulk add ──────────────────────────────────────────────

export interface ParseResult {
  name: string;
  lecturer: string | null;
  workshop: string | null;
}

export interface ScanFolderEntry {
  path: string;
  basename: string;
  suggestedName: string;
  suggestedLecturer: string | null;
  suggestedWorkshop: string | null;
  alreadyTracked: boolean;
}

export interface ScanFolderResponse {
  folder: string;
  recursive: boolean;
  found: ScanFolderEntry[];
}

export interface BulkAddResponse {
  added: Video[];
  skipped: Array<{ path: string; reason: string }>;
  errors: Array<{ path: string; error: string }>;
}

export interface HandoffResponse {
  message: string;
}

export interface RatingInputBody {
  rating: number;
  note?: string;
}

export interface RatingResponse {
  video: Video;
  entry: unknown;
}

// ─── batch mode ───────────────────────────────────────────────────────────

export type BatchPhase = 'phase1' | 'transcribe' | 'microEvents' | 'render';

export type BatchStatus = 'running' | 'done' | 'failed' | 'cancelled';

export type BatchResultStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface BatchResult {
  videoId: string;
  jobId: string | null;
  status: BatchResultStatus;
  error?: string;
}

export interface BatchSnapshot {
  id: string;
  phase: BatchPhase;
  videoIds: string[];
  currentIndex: number;
  total: number;
  status: BatchStatus;
  continueOnError: boolean;
  cancelRequested: boolean;
  results: BatchResult[];
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface StartBatchResponse extends BatchSnapshot {
  batchId: string;
  jobIds: Array<string | null>;
}

export type BatchEvent =
  | { type: 'start'; batchId: string; phase: BatchPhase; total: number }
  | {
      type: 'progress';
      batchId: string;
      currentIndex: number;
      total: number;
      currentVideoId: string;
    }
  | {
      type: 'video-done';
      batchId: string;
      index: number;
      videoId: string;
      jobId: string | null;
      status: BatchResultStatus;
      error?: string;
    }
  | { type: 'done'; batchId: string; results: BatchResult[] }
  | { type: 'failed'; batchId: string; error: string }
  | { type: 'cancelled'; batchId: string }
  | { type: 'cancel-requested'; batchId: string };
