import type {
  Video,
  JobStartResponse,
  PhaseId,
  ProgressEvent,
  AddVideoInput,
  EditHandoffResponse,
  HandoffResponse,
  RatingResponse,
  BatchPhase,
  BatchEvent,
  BatchResult,
  BatchSnapshot,
  StartBatchResponse,
  ParseResult,
  ScanFolderResponse,
  BulkAddResponse,
  MegaHandoffResponse,
  MegaCommitResponse,
} from './types';

const API = '/api';

async function jsonOrThrow(r: Response, label: string): Promise<unknown> {
  if (!r.ok) {
    let msg = `${label}: ${r.status}`;
    try {
      const body = await r.json();
      if (body && typeof body === 'object' && 'error' in body) {
        msg = `${label}: ${(body as { error: string }).error}`;
      }
    } catch {
      // ignore — fall back to status-only message
    }
    throw new Error(msg);
  }
  return r.json();
}

export async function listVideos(): Promise<Video[]> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/videos`),
    'listVideos',
  )) as { videos: Video[] };
  return body.videos;
}

export async function getVideo(id: string): Promise<Video> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/videos/${encodeURIComponent(id)}`),
    'getVideo',
  )) as { video: Video };
  return body.video;
}

export async function addVideo(input: AddVideoInput): Promise<Video> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
    'addVideo',
  )) as { video: Video };
  return body.video;
}

export async function removeVideo(id: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`${API}/videos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
    'removeVideo',
  );
}

// ─── Parse a single video path (auto-fill suggestion) ───────────────────
export async function parseVideoPath(videoPath: string): Promise<ParseResult> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/videos/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: videoPath }),
    }),
    'parseVideoPath',
  )) as ParseResult;
  return body;
}

// ─── Scan a folder for videos ────────────────────────────────────────────
export async function scanFolder(
  folderPath: string,
  recursive = false,
): Promise<ScanFolderResponse> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/videos/scan-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath, recursive }),
    }),
    'scanFolder',
  )) as ScanFolderResponse;
  return body;
}

// ─── Bulk add multiple videos at once ────────────────────────────────────
export async function bulkAddVideos(
  videos: AddVideoInput[],
): Promise<BulkAddResponse> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/videos/bulk-add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videos }),
    }),
    'bulkAddVideos',
  )) as BulkAddResponse;
  return body;
}

// ─── Mega-batch (Mode B) ─────────────────────────────────────────────────
export async function megaHandoffAll(
  videoIds: string[],
): Promise<MegaHandoffResponse> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/mega/handoff-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds }),
    }),
    'megaHandoffAll',
  )) as MegaHandoffResponse;
  return body;
}

export async function megaCommitBatch(
  videoIds: string[],
  batchNote?: string,
): Promise<MegaCommitResponse> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/mega/commit-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds, batchNote }),
    }),
    'megaCommitBatch',
  )) as MegaCommitResponse;
  return body;
}

// Routes for job-spawning phases. `edit` is NOT included — it has a different
// response shape (see getEditHandoff below).
const JOB_PHASE_ROUTE: Record<
  Exclude<PhaseId, 'edit' | 'analyze'>,
  string
> = {
  phase1: 'phase1',
  transcribe: 'transcribe',
  microEvents: 'micro-events',
  render: 'render',
};

export async function runPhase(
  videoId: string,
  phase: Exclude<PhaseId, 'edit' | 'analyze'>,
): Promise<JobStartResponse> {
  const route = JOB_PHASE_ROUTE[phase];
  const body = (await jsonOrThrow(
    await fetch(
      `${API}/videos/${encodeURIComponent(videoId)}/${route}`,
      { method: 'POST' },
    ),
    `runPhase(${phase})`,
  )) as JobStartResponse;
  return body;
}

export async function getEditHandoff(
  videoId: string,
): Promise<EditHandoffResponse> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/videos/${encodeURIComponent(videoId)}/edit`, {
      method: 'POST',
    }),
    'getEditHandoff',
  )) as EditHandoffResponse;
  return body;
}

export async function getHandoffMessage(
  videoId: string,
): Promise<HandoffResponse> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/videos/${encodeURIComponent(videoId)}/handoff`, {
      method: 'POST',
    }),
    'getHandoffMessage',
  )) as HandoffResponse;
  return body;
}

export async function submitRating(
  videoId: string,
  rating: number,
  note?: string,
): Promise<RatingResponse> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/videos/${encodeURIComponent(videoId)}/rating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, note }),
    }),
    'submitRating',
  )) as RatingResponse;
  return body;
}

// ─── batch mode ───────────────────────────────────────────────────────────

export async function startBatch(
  phase: BatchPhase,
  videoIds: string[],
  continueOnError = true,
): Promise<StartBatchResponse> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/batch/${encodeURIComponent(phase)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds, continueOnError }),
    }),
    'startBatch',
  )) as StartBatchResponse;
  return body;
}

export async function getBatchStatus(batchId: string): Promise<BatchSnapshot> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/batch/${encodeURIComponent(batchId)}`),
    'getBatchStatus',
  )) as BatchSnapshot;
  return body;
}

export async function cancelBatch(batchId: string): Promise<BatchSnapshot> {
  const body = (await jsonOrThrow(
    await fetch(`${API}/batch/${encodeURIComponent(batchId)}/cancel`, {
      method: 'POST',
    }),
    'cancelBatch',
  )) as BatchSnapshot;
  return body;
}

/**
 * Subscribe to a running batch via Server-Sent Events. Returns an
 * unsubscribe function that closes the EventSource.
 */
export function subscribeToBatch(
  batchId: string,
  onEvent: (e: BatchEvent) => void,
): () => void {
  const es = new EventSource(
    `${API}/batch/${encodeURIComponent(batchId)}/stream`,
  );

  const parse = (ev: Event): unknown => {
    try {
      return JSON.parse((ev as MessageEvent).data);
    } catch {
      return null;
    }
  };

  es.addEventListener('batch:start', (ev) => {
    const d = parse(ev) as {
      batchId: string;
      phase: BatchPhase;
      total: number;
    } | null;
    if (d) onEvent({ type: 'start', ...d });
  });

  es.addEventListener('batch:progress', (ev) => {
    const d = parse(ev) as {
      batchId: string;
      currentIndex: number;
      total: number;
      currentVideoId: string;
    } | null;
    if (d) onEvent({ type: 'progress', ...d });
  });

  es.addEventListener('batch:video-done', (ev) => {
    const d = parse(ev) as {
      batchId: string;
      index: number;
      videoId: string;
      jobId: string | null;
      status:
        | 'pending'
        | 'running'
        | 'done'
        | 'failed'
        | 'skipped'
        | 'cancelled';
      error?: string;
    } | null;
    if (d) onEvent({ type: 'video-done', ...d });
  });

  es.addEventListener('batch:done', (ev) => {
    const d = parse(ev) as { batchId: string; results: BatchResult[] } | null;
    if (d) onEvent({ type: 'done', batchId: d.batchId, results: d.results });
    es.close();
  });

  es.addEventListener('batch:failed', (ev) => {
    const d = parse(ev) as { batchId: string; error: string } | null;
    if (d) onEvent({ type: 'failed', batchId: d.batchId, error: d.error });
    es.close();
  });

  es.addEventListener('batch:cancelled', (ev) => {
    const d = parse(ev) as { batchId: string } | null;
    if (d) onEvent({ type: 'cancelled', batchId: d.batchId });
    es.close();
  });

  es.addEventListener('batch:cancel-requested', (ev) => {
    const d = parse(ev) as { batchId: string } | null;
    if (d) onEvent({ type: 'cancel-requested', batchId: d.batchId });
  });

  return () => es.close();
}

// Subscribe to a running job via Server-Sent Events. Returns an unsubscribe
// function that closes the EventSource.
export function subscribeToProgress(
  jobId: string,
  onEvent: (e: ProgressEvent) => void,
): () => void {
  const es = new EventSource(`${API}/progress/${encodeURIComponent(jobId)}`);

  es.addEventListener('line', (ev) => {
    try {
      const { text } = JSON.parse((ev as MessageEvent).data);
      onEvent({ type: 'line', text });
    } catch {
      /* ignore malformed frame */
    }
  });

  es.addEventListener('done', (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data);
      onEvent({ type: 'done', exitCode: data.exitCode, status: data.status });
    } catch {
      onEvent({ type: 'done', exitCode: -1 });
    } finally {
      es.close();
    }
  });

  // Custom server-emitted "error" events (different from EventSource's built-in
  // error event which fires on network failure).
  es.addEventListener('error', (ev) => {
    const msgEv = ev as MessageEvent;
    if (msgEv.data) {
      try {
        const data = JSON.parse(msgEv.data);
        onEvent({ type: 'error', message: data.message ?? 'unknown error' });
      } catch {
        onEvent({ type: 'error', message: 'unparseable error frame' });
      }
      es.close();
    }
    // If there's no data, this is a network-level error — leave the EventSource
    // alone so it can auto-reconnect.
  });

  return () => es.close();
}
