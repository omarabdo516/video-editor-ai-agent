// Sequential batch runner for dashboard bulk mode.
//
// A batch is a list of videoIds + a single phase to run on each. The runner
// spawns one phase job at a time, awaits its completion via waitForJob(),
// and moves on to the next video. Sequential is mandatory — the RTX 5060 Ti
// is a single GPU and transcode/render jobs each saturate it.
//
// Batch state is in-memory only; if the server restarts mid-batch the batch
// is lost (but the already-completed videos' phase state is persisted in
// state/videos.json via updateVideoPhase).

import { randomUUID } from 'node:crypto';
import {
  createJob,
  runJob,
  commandForPhase,
  waitForJob,
} from './jobs.mjs';
import { updateVideoPhase } from './state.mjs';

const GC_DELAY_MS = 10 * 60 * 1000;
const LINE_BUFFER_LIMIT = 500;

/** Phases that are allowed to run as a batch. edit + analyze are manual. */
export const BATCHABLE_PHASES = new Set([
  'phase1',
  'transcribe',
  'microEvents',
  'render',
]);

/** @type {Map<string, Batch>} */
const batches = new Map();

/**
 * @typedef {Object} BatchResult
 * @property {string} videoId
 * @property {string|null} jobId
 * @property {'pending'|'running'|'done'|'failed'|'skipped'|'cancelled'} status
 * @property {string=} error
 */

/**
 * @typedef {Object} Batch
 * @property {string} id
 * @property {string} phase
 * @property {string[]} videoIds
 * @property {number} currentIndex
 * @property {'running'|'done'|'failed'|'cancelled'} status
 * @property {boolean} continueOnError
 * @property {boolean} cancelRequested
 * @property {BatchResult[]} results
 * @property {string[]} lines   recent event lines for late subscribers
 * @property {string} startedAt
 * @property {string=} finishedAt
 * @property {string=} error
 * @property {Set<import('http').ServerResponse>} subscribers
 */

/**
 * Create and register a batch. Does NOT start it — call runBatch() next.
 * @param {{ videoIds: string[], phase: string, continueOnError?: boolean }} opts
 */
export function createBatch({ videoIds, phase, continueOnError = true }) {
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    throw new Error('videoIds must be a non-empty array');
  }
  if (!BATCHABLE_PHASES.has(phase)) {
    throw new Error(`phase not batchable: ${phase}`);
  }

  /** @type {Batch} */
  const batch = {
    id: randomUUID().slice(0, 12),
    phase,
    videoIds: [...videoIds],
    currentIndex: 0,
    status: 'running',
    continueOnError,
    cancelRequested: false,
    results: videoIds.map((videoId) => ({
      videoId,
      jobId: null,
      status: 'pending',
    })),
    lines: [],
    startedAt: new Date().toISOString(),
    subscribers: new Set(),
  };

  batches.set(batch.id, batch);
  return batch;
}

/**
 * Iterate the batch's videos sequentially. For each video, spawn the phase
 * job and await its completion. Emits events to any SSE subscribers so the
 * UI can tick a progress indicator.
 *
 * This is async but the batch route doesn't await it — it returns the IDs
 * immediately and the batch runs in the background.
 *
 * @param {Batch} batch
 */
export async function runBatch(batch) {
  emit(batch, 'batch:start', {
    batchId: batch.id,
    phase: batch.phase,
    total: batch.videoIds.length,
  });

  for (let i = 0; i < batch.videoIds.length; i++) {
    if (batch.cancelRequested) {
      markRemainingCancelled(batch, i);
      emit(batch, 'batch:cancelled', { batchId: batch.id });
      finalize(batch, 'cancelled');
      return;
    }

    batch.currentIndex = i;
    const videoId = batch.videoIds[i];
    const result = batch.results[i];

    emit(batch, 'batch:progress', {
      batchId: batch.id,
      currentIndex: i,
      total: batch.videoIds.length,
      currentVideoId: videoId,
    });

    const lookup = commandForPhase(videoId, batch.phase);
    if (lookup.error) {
      result.status = 'failed';
      result.error = lookup.error;
      emit(batch, 'batch:video-done', {
        batchId: batch.id,
        index: i,
        videoId,
        jobId: null,
        status: 'failed',
        error: lookup.error,
      });
      if (!batch.continueOnError) {
        markRemainingCancelled(batch, i + 1);
        emit(batch, 'batch:failed', { batchId: batch.id, error: lookup.error });
        finalize(batch, 'failed', lookup.error);
        return;
      }
      continue;
    }

    const job = createJob(videoId, batch.phase, lookup.cmd, lookup.args);
    result.jobId = job.id;
    result.status = 'running';

    updateVideoPhase(videoId, batch.phase, {
      status: 'running',
      startedAt: job.startedAt,
      lastJobId: job.id,
      finishedAt: null,
      exitCode: null,
      error: null,
    });
    runJob(job);

    let outcome;
    try {
      outcome = await waitForJob(job.id);
    } catch (e) {
      outcome = { exitCode: -1, status: 'failed' };
      result.error = e instanceof Error ? e.message : String(e);
    }

    if (outcome.status === 'done' && outcome.exitCode === 0) {
      result.status = 'done';
      emit(batch, 'batch:video-done', {
        batchId: batch.id,
        index: i,
        videoId,
        jobId: job.id,
        status: 'done',
      });
    } else {
      result.status = 'failed';
      result.error = result.error || `exit ${outcome.exitCode}`;
      emit(batch, 'batch:video-done', {
        batchId: batch.id,
        index: i,
        videoId,
        jobId: job.id,
        status: 'failed',
        error: result.error,
      });
      if (!batch.continueOnError) {
        markRemainingCancelled(batch, i + 1);
        emit(batch, 'batch:failed', { batchId: batch.id, error: result.error });
        finalize(batch, 'failed', result.error);
        return;
      }
    }
  }

  emit(batch, 'batch:done', {
    batchId: batch.id,
    results: batch.results,
  });
  finalize(batch, 'done');
}

/** Request cancellation of a running batch. Current job finishes, rest are skipped. */
export function cancelBatch(batchId) {
  const batch = batches.get(batchId);
  if (!batch) return null;
  if (batch.status !== 'running') return batch;
  batch.cancelRequested = true;
  emit(batch, 'batch:cancel-requested', { batchId: batch.id });
  return batch;
}

export function getBatch(batchId) {
  return batches.get(batchId) || null;
}

export function listBatches() {
  return [...batches.values()].map(summarizeBatch);
}

export function summarizeBatch(batch) {
  return {
    id: batch.id,
    phase: batch.phase,
    videoIds: batch.videoIds,
    currentIndex: batch.currentIndex,
    total: batch.videoIds.length,
    status: batch.status,
    continueOnError: batch.continueOnError,
    cancelRequested: batch.cancelRequested,
    results: batch.results,
    startedAt: batch.startedAt,
    finishedAt: batch.finishedAt,
    error: batch.error,
  };
}

// ─── SSE subscription ─────────────────────────────────────────────────────

/**
 * Subscribe an SSE response to a batch's event stream. Replays recent
 * events so late subscribers see context. If the batch is already
 * finished, emits the terminal event and closes the connection.
 */
export function subscribeToBatch(batchId, res) {
  const batch = batches.get(batchId);
  if (!batch) return null;

  // Replay recent events as raw lines (reconstructed as "event: ...").
  // The terminal event is already in the buffer for finished batches, so
  // we don't re-emit it below — just close the stream after replay.
  for (const frame of batch.lines) {
    res.write(frame);
  }

  if (batch.status !== 'running') {
    res.end();
    return batch;
  }

  batch.subscribers.add(res);
  res.on('close', () => batch.subscribers.delete(res));
  return batch;
}

// ─── internal ─────────────────────────────────────────────────────────────

function emit(batch, event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  if (batch.lines.length >= LINE_BUFFER_LIMIT) batch.lines.shift();
  batch.lines.push(frame);
  for (const res of batch.subscribers) {
    try {
      res.write(frame);
    } catch {
      // socket died — the SSE handler cleans up on 'close'
    }
  }
}

function markRemainingCancelled(batch, fromIndex) {
  for (let j = fromIndex; j < batch.results.length; j++) {
    if (batch.results[j].status === 'pending') {
      batch.results[j].status = 'cancelled';
    }
  }
}

function finalize(batch, status, error) {
  batch.status = status;
  batch.finishedAt = new Date().toISOString();
  if (error) batch.error = error;

  // Close SSE subscribers so clients know to disconnect.
  for (const res of batch.subscribers) {
    try {
      res.end();
    } catch {}
  }
  batch.subscribers.clear();

  const t = setTimeout(() => batches.delete(batch.id), GC_DELAY_MS);
  if (t.unref) t.unref();
}
