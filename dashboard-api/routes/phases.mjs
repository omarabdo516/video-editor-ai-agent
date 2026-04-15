import { Router } from 'express';
import { existsSync } from 'node:fs';
import {
  createJob,
  runJob,
  commandForPhase,
} from '../lib/jobs.mjs';
import { getVideo, updateVideoPhase } from '../lib/state.mjs';
import {
  scaledVideoPath,
  captionsPath,
  videoBasename,
  resolveExisting,
} from '../lib/paths.mjs';
import { buildHandoffMessage } from '../lib/handoff.mjs';
import { startEditor } from '../lib/editorSession.mjs';

export const phasesRouter = Router();

// ─── helper: start a spawned phase ────────────────────────────────────────
function startPhase(videoId, phase, res) {
  const lookup = commandForPhase(videoId, phase);
  if (lookup.error) {
    return res
      .status(lookup.error === 'video not found' ? 404 : 400)
      .json({ error: lookup.error });
  }
  const job = createJob(videoId, phase, lookup.cmd, lookup.args);
  runJob(job);
  updateVideoPhase(videoId, phase, {
    status: 'running',
    startedAt: job.startedAt,
    lastJobId: job.id,
    finishedAt: null,
    exitCode: null,
  });
  res.status(202).json({
    jobId: job.id,
    status: 'running',
    phase,
    videoId,
    cmd: lookup.cmd,
    args: lookup.args,
  });
}

phasesRouter.post('/:id/phase1', (req, res) =>
  startPhase(req.params.id, 'phase1', res),
);

phasesRouter.post('/:id/transcribe', (req, res) =>
  startPhase(req.params.id, 'transcribe', res),
);

phasesRouter.post('/:id/micro-events', (req, res) =>
  startPhase(req.params.id, 'microEvents', res),
);

phasesRouter.post('/:id/render', (req, res) =>
  startPhase(req.params.id, 'render', res),
);

// ─── /edit — spawns rs-reels.mjs edit and returns a ready-to-open URL ───
//
// The subtitle editor needs two things running at once:
//   1. rs-reels file server on :7777 (serves video + captions + save hooks)
//   2. Vite dev server on :5173 (the UI itself)
//
// Both are started by `node rs-reels.mjs edit <video>`. This route spawns
// that command as a managed singleton subprocess (via lib/editorSession)
// and waits for port 5173 to accept connections before returning. The
// frontend can then open the URL without hitting a "site can't be reached"
// error.
//
// Because both ports are fixed, only ONE editor session is alive at a
// time. Switching to a different video tears the old one down first.
phasesRouter.post('/:id/edit', async (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });

  // resolveExisting checks both the new _pipeline/ layout and the
  // legacy flat layout, so the readiness flags work for videos that
  // haven't been migrated yet.
  const scaled = resolveExisting(video.path, 'scaled');
  const caps = resolveExisting(video.path, 'captions');
  const baseName = videoBasename(video.path);

  const scaledReady = existsSync(scaled);
  const captionsReady = existsSync(caps);

  // Build the same URL shape rs-reels.mjs edit prints internally.
  const params = new URLSearchParams({
    video: 'http://127.0.0.1:7777/video.mp4',
    name: baseName,
    saveBase: 'http://127.0.0.1:7777',
  });
  if (captionsReady) {
    params.set('captions', 'http://127.0.0.1:7777/captions.json');
  }
  const editorUrl = `http://localhost:5173/?${params.toString()}`;

  try {
    const session = await startEditor({
      videoId: video.id,
      videoPath: video.path,
      editorUrl,
    });
    res.json({
      editorUrl: session.editorUrl,
      scaledReady,
      captionsReady,
      ready: session.ready,
      reused: session.reused,
      filePort: session.filePort,
      editorPort: session.editorPort,
      hintCommand: `node rs-reels.mjs edit "${video.path}"`,
      note: session.ready
        ? 'Editor is ready — open editorUrl in a new tab.'
        : 'Editor did not become ready within 30s. Check the API log or run hintCommand in a terminal.',
    });
  } catch (e) {
    res.status(500).json({ error: `failed to start editor: ${e.message}` });
  }
});


// ─── /handoff — Claude Phase 5/6 handoff message (no job spawned) ─────────
//
// Assembles a pre-formatted text block Omar can paste into a fresh Claude
// session. The dashboard never invokes Claude directly — this is a
// copy-paste bridge.
phasesRouter.post('/:id/handoff', (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });
  const message = buildHandoffMessage(video);
  res.json({ message });
});
