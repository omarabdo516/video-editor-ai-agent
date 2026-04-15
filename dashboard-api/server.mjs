// RS Reels Dashboard API — Express wrapper over rs-reels.mjs.
//
// Starts a localhost HTTP server that exposes each pipeline phase as a
// POST endpoint, streams job output via SSE, and persists per-video
// status to dashboard-api/state/videos.json.

import express from 'express';
import cors from 'cors';
import { videosRouter } from './routes/videos.mjs';
import { phasesRouter } from './routes/phases.mjs';
import { progressRouter } from './routes/progress.mjs';
import { ratingRouter } from './routes/rating.mjs';
import { batchRouter } from './routes/batch.mjs';
import { loadState } from './lib/state.mjs';
import { listJobs } from './lib/jobs.mjs';
import { shutdownEditor } from './lib/editorSession.mjs';

const PORT = Number(process.env.DASHBOARD_PORT) || 7778;

const app = express();

// Accept the full 5174-5179 range so Vite's fallback-port behavior
// (when 5174 is already taken by an orphan dev server) doesn't
// break the Dashboard UI's fetch calls.
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1):517[0-9]$/.test(origin)) {
        return cb(null, true);
      }
      cb(null, false);
    },
  }),
);
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/jobs', (_req, res) => res.json({ jobs: listJobs() }));

app.use('/api/videos', videosRouter);
app.use('/api/videos', phasesRouter);
app.use('/api/videos', ratingRouter);
app.use('/api/progress', progressRouter);
app.use('/api/batch', batchRouter);

// Generic error handler — keeps JSON shape consistent.
app.use((err, _req, res, _next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: err.message || 'internal error' });
});

loadState();

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Dashboard API on http://localhost:${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`\n${signal} received — closing server`);
  // Tear down any managed subtitle editor subprocess first so we don't
  // leave orphans holding ports 7777/5173.
  try {
    await shutdownEditor();
  } catch (e) {
    console.warn(`[shutdown] editor teardown failed: ${e.message}`);
  }
  server.close(() => process.exit(0));
  // Fallback: force-exit after 5s if something hangs.
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
