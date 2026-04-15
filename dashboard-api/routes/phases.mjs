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
} from '../lib/paths.mjs';

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

// ─── /edit — returns an editor URL, no job spawned ────────────────────────
//
// The subtitle editor needs two things running separately:
//   1. rs-reels file server on :7777 (serves video + captions + save hooks)
//   2. Vite dev server on :5173 (the UI itself)
// Starting either of those from the dashboard is out of scope for session 2,
// so this route just returns the same URL shape rs-reels would print, plus
// a hint command. Session 4 will tighten the handoff.
phasesRouter.post('/:id/edit', (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });

  const scaled = scaledVideoPath(video.path);
  const caps = captionsPath(video.path);
  const baseName = videoBasename(video.path);

  const scaledReady = existsSync(scaled);
  const captionsReady = existsSync(caps);

  const params = new URLSearchParams({
    video: 'http://127.0.0.1:7777/video.mp4',
    name: baseName,
    saveBase: 'http://127.0.0.1:7777',
  });
  if (captionsReady) {
    params.set('captions', 'http://127.0.0.1:7777/captions.json');
  }
  const editorUrl = `http://localhost:5173/?${params.toString()}`;

  res.json({
    editorUrl,
    scaledReady,
    captionsReady,
    // Hint the UI can surface to Omar until session 4 automates the handoff.
    hintCommand: `node rs-reels.mjs edit "${video.path}"`,
    note:
      'The file server (:7777) + Vite dev server (:5173) must be running. ' +
      'Run the hintCommand in a separate terminal, then open editorUrl.',
  });
});
