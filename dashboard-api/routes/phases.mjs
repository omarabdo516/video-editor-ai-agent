import { Router } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import {
  createJob,
  runJob,
  waitForJob,
  commandForPhase,
  appendJobLine,
  emitJobEvent,
} from '../lib/jobs.mjs';
import { getVideo, updateVideoPhase } from '../lib/state.mjs';
import {
  scaledVideoPath,
  captionsPath,
  videoBasename,
  resolveExisting,
  animationPlanPath,
} from '../lib/paths.mjs';
import { buildHandoffMessage } from '../lib/handoff.mjs';
import { startEditor } from '../lib/editorSession.mjs';
import { validatePlan, loadBrandRules, formatVerdict } from '../lib/brandValidator.mjs';

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

// ─── /plan — Stage α: Claude planner + auto-render chain ──────────────────
//
// Replaces the copy-paste handoff. Spawns scripts/run_claude_planner.mjs
// which assembles full creative-director context, invokes `claude -p`,
// and writes content_analysis.json + animation_plan.json to disk.
//
// On success, automatically queues the render job. The UI sees plan=done
// followed by render=running in the video state without a second click.
phasesRouter.post('/:id/plan', (req, res) => {
  const lookup = commandForPhase(req.params.id, 'plan');
  if (lookup.error) {
    return res
      .status(lookup.error === 'video not found' ? 404 : 400)
      .json({ error: lookup.error });
  }
  const videoId = req.params.id;
  const planJob = createJob(videoId, 'plan', lookup.cmd, lookup.args);

  // afterExit hook: runs validator while plan job's SSE subscribers are
  // still connected, so the verdict streams in the same panel.
  const afterExit = async (job, exitCode) => {
    if (exitCode !== 0) return; // planner failed; nothing to validate
    const video = getVideo(videoId);
    if (!video) return;
    const planFile = animationPlanPath(video.path);
    let plan;
    try {
      plan = JSON.parse(readFileSync(planFile, 'utf8'));
    } catch (err) {
      appendJobLine(job.id, `[validator] could not read plan at ${planFile}: ${err.message}`);
      job.validatorVerdict = { passed: false, hardViolations: [{ rule: 'io', path: planFile, message: err.message }], softWarnings: [] };
      return;
    }
    let verdict;
    try {
      verdict = validatePlan(plan, loadBrandRules());
    } catch (err) {
      appendJobLine(job.id, `[validator] threw: ${err.message}`);
      job.validatorVerdict = { passed: false, hardViolations: [{ rule: 'validator_error', path: '', message: err.message }], softWarnings: [] };
      return;
    }
    job.validatorVerdict = verdict;
    updateVideoPhase(videoId, 'plan', { validatorVerdict: verdict });
    appendJobLine(job.id, '');
    for (const line of formatVerdict(verdict).split('\n')) {
      appendJobLine(job.id, line);
    }
    if (verdict.passed) {
      emitJobEvent(job.id, 'validator-passed', { verdict });
    } else {
      emitJobEvent(job.id, 'validator-rejected', { verdict });
    }
  };

  runJob(planJob, { afterExit });
  updateVideoPhase(videoId, 'plan', {
    status: 'running',
    startedAt: planJob.startedAt,
    lastJobId: planJob.id,
    finishedAt: null,
    exitCode: null,
  });

  // Background chain: when plan finishes successfully AND validator passes,
  // kick off render. Errors here are non-fatal (the user can retry).
  waitForJob(planJob.id)
    .then(({ exitCode, status }) => {
      if (status !== 'done' || exitCode !== 0) {
        console.log(
          `[plan→render] plan job ${planJob.id} did not succeed (status=${status}, code=${exitCode}); skipping auto-render`,
        );
        return;
      }
      if (planJob.validatorVerdict && !planJob.validatorVerdict.passed) {
        console.log(
          `[plan→render] validator rejected plan for video ${videoId}; skipping auto-render`,
        );
        return;
      }
      const renderLookup = commandForPhase(videoId, 'render');
      if (renderLookup.error) {
        console.warn(`[plan→render] render lookup failed: ${renderLookup.error}`);
        return;
      }
      const renderJob = createJob(
        videoId,
        'render',
        renderLookup.cmd,
        renderLookup.args,
      );
      runJob(renderJob);
      updateVideoPhase(videoId, 'render', {
        status: 'running',
        startedAt: renderJob.startedAt,
        lastJobId: renderJob.id,
        finishedAt: null,
        exitCode: null,
      });
      console.log(
        `[plan→render] auto-started render job ${renderJob.id} for video ${videoId}`,
      );
    })
    .catch((err) => {
      console.error(`[plan→render] chain error: ${err.message}`);
    });

  res.status(202).json({
    jobId: planJob.id,
    status: 'running',
    phase: 'plan',
    videoId,
    cmd: lookup.cmd,
    args: lookup.args,
    autoRenderOnSuccess: true,
  });
});

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
