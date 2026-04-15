// In-memory job registry for spawned pipeline processes.
//
// Each job streams stdout + stderr line-by-line to a bounded ring buffer
// (last 500 lines) and to any live SSE subscribers. Finished jobs stick
// around for a short grace period so the UI can fetch the final lines
// after reconnecting, then they get garbage-collected.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { updateVideoPhase, getVideo } from './state.mjs';
import { REPO_ROOT } from './paths.mjs';

const LINE_BUFFER_LIMIT = 500;
const GC_DELAY_MS = 5 * 60 * 1000;

/** @type {Map<string, Job>} */
const jobs = new Map();

// ─── phase → command dictionary ───────────────────────────────────────────
//
// Central place that knows how to translate a (video, phase) pair into a
// spawnable command. Routes stay thin — they just look up the entry and
// hand it to createJob/runJob.
//
// IMPORTANT: commands run with cwd = REPO_ROOT so relative arg paths (like
// `scripts/generate_micro_events.mjs`) resolve the same way they would
// when Omar invokes them by hand from the repo root.
export const PHASE_COMMANDS = {
  phase1: (video) => ({
    cmd: 'node',
    args: ['rs-reels.mjs', 'phase1', video.path],
  }),
  transcribe: (video) => ({
    cmd: 'node',
    args: [
      'rs-reels.mjs',
      'make',
      video.path,
      '--lecturer', video.lecturer || 'محاضر',
      '--workshop', video.workshop || 'RS',
      '--skip-audio',
      '--dry',
    ],
  }),
  microEvents: (video) => ({
    cmd: 'node',
    args: ['scripts/generate_micro_events.mjs', video.name],
  }),
  render: (video) => ({
    cmd: 'node',
    args: [
      'rs-reels.mjs',
      'make',
      video.path,
      '--lecturer', video.lecturer || 'محاضر',
      '--workshop', video.workshop || 'RS',
      '--skip-audio',
      '--skip-transcribe',
    ],
  }),
};

/**
 * @typedef {Object} Job
 * @property {string} id
 * @property {string} videoId
 * @property {string} phase
 * @property {'running'|'done'|'failed'|'cancelled'} status
 * @property {string} startedAt
 * @property {string=} finishedAt
 * @property {number=} exitCode
 * @property {string[]} lines
 * @property {Set<import('http').ServerResponse>} subscribers
 * @property {import('child_process').ChildProcess=} child
 */

/** Create and register a job without starting it. */
export function createJob(videoId, phase, cmd, args) {
  /** @type {Job} */
  const job = {
    id: randomUUID().slice(0, 12),
    videoId,
    phase,
    cmd,
    args,
    status: 'running',
    startedAt: new Date().toISOString(),
    lines: [],
    subscribers: new Set(),
  };
  jobs.set(job.id, job);
  return job;
}

/** Start the spawned process and wire its output into the job. */
export function runJob(job) {
  const child = spawn(job.cmd, job.args, {
    cwd: REPO_ROOT,
    shell: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  job.child = child;

  const pushLine = (text) => {
    if (job.lines.length >= LINE_BUFFER_LIMIT) job.lines.shift();
    job.lines.push(text);
    broadcast(job, 'line', { text });
  };

  // Buffer partial chunks so we emit one event per newline.
  const makeSplitter = () => {
    let buf = '';
    return (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        pushLine(line);
      }
    };
  };

  child.stdout.on('data', makeSplitter());
  child.stderr.on('data', makeSplitter());

  child.on('error', (err) => {
    pushLine(`[spawn error] ${err.message}`);
    finish(job, 'failed', -1);
  });

  child.on('exit', (code) => {
    const status = code === 0 ? 'done' : 'failed';
    finish(job, status, code ?? -1);
  });

  return job;
}

function finish(job, status, exitCode) {
  if (job.status !== 'running') return;
  job.status = status;
  job.exitCode = exitCode;
  job.finishedAt = new Date().toISOString();

  // Mirror into persisted video state so the UI survives reconnects.
  try {
    updateVideoPhase(job.videoId, job.phase, {
      status,
      finishedAt: job.finishedAt,
      lastJobId: job.id,
      exitCode,
    });
  } catch (e) {
    console.warn(`[jobs] failed to persist phase update: ${e.message}`);
  }

  broadcast(job, 'done', { exitCode, status });
  // Close all SSE subscribers so clients know to disconnect.
  for (const res of job.subscribers) {
    try {
      res.end();
    } catch {}
  }
  job.subscribers.clear();

  // GC after grace period so late-connecting clients can still fetch
  // the final state, then free memory.
  const t = setTimeout(() => jobs.delete(job.id), GC_DELAY_MS);
  if (t.unref) t.unref();
}

function broadcast(job, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of job.subscribers) {
    try {
      res.write(payload);
    } catch {
      // socket died — the SSE handler will clean up on 'close'
    }
  }
}

/** Subscribe an SSE response to a job's output stream. */
export function subscribeToJob(jobId, res) {
  const job = jobs.get(jobId);
  if (!job) return null;

  // Replay the buffered lines so a late subscriber sees context.
  for (const text of job.lines) {
    res.write(`event: line\ndata: ${JSON.stringify({ text })}\n\n`);
  }

  if (job.status !== 'running') {
    // Emit the terminal event and end immediately.
    res.write(
      `event: done\ndata: ${JSON.stringify({
        exitCode: job.exitCode ?? 0,
        status: job.status,
      })}\n\n`,
    );
    res.end();
    return job;
  }

  job.subscribers.add(res);
  res.on('close', () => job.subscribers.delete(res));
  return job;
}

export function getJob(jobId) {
  return jobs.get(jobId) || null;
}

export function listJobs() {
  return [...jobs.values()].map((j) => ({
    id: j.id,
    videoId: j.videoId,
    phase: j.phase,
    status: j.status,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    exitCode: j.exitCode,
    lineCount: j.lines.length,
  }));
}

// Re-export for routes that want the video-aware command lookup.
export function commandForPhase(videoId, phase) {
  const video = getVideo(videoId);
  if (!video) return { error: 'video not found' };
  const build = PHASE_COMMANDS[phase];
  if (!build) return { error: `unknown phase: ${phase}` };
  return { video, ...build(video) };
}
