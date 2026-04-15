// Batch mode routes — multi-video sequential phase runner.
//
// POST /api/batch/:phase      start a batch on the given videoIds
// GET  /api/batch/:batchId    current status snapshot
// POST /api/batch/:batchId/cancel  request cancellation (current job finishes)
// GET  /api/batch/:batchId/stream  Server-Sent Events for progress

import { Router } from 'express';
import {
  BATCHABLE_PHASES,
  createBatch,
  runBatch,
  cancelBatch,
  getBatch,
  subscribeToBatch,
  summarizeBatch,
  listBatches,
} from '../lib/batch.mjs';

export const batchRouter = Router();

batchRouter.get('/', (_req, res) => {
  res.json({ batches: listBatches() });
});

batchRouter.post('/:phase', (req, res) => {
  const { phase } = req.params;
  if (!BATCHABLE_PHASES.has(phase)) {
    return res.status(400).json({
      error: `phase not batchable: ${phase} (allowed: ${[...BATCHABLE_PHASES].join(', ')})`,
    });
  }

  const { videoIds, continueOnError } = req.body ?? {};
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'videoIds must be a non-empty array' });
  }

  let batch;
  try {
    batch = createBatch({
      videoIds,
      phase,
      continueOnError: continueOnError !== false,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // Fire-and-forget — the runner iterates the videos async and emits SSE
  // events to any subscribers. Errors inside the runner are captured in
  // batch.status / batch.error.
  runBatch(batch).catch((e) => {
    console.error(`[batch ${batch.id}] runner crashed:`, e);
  });

  res.status(202).json({
    batchId: batch.id,
    jobIds: batch.results.map((r) => r.jobId),
    ...summarizeBatch(batch),
  });
});

batchRouter.get('/:batchId', (req, res) => {
  const batch = getBatch(req.params.batchId);
  if (!batch) return res.status(404).json({ error: 'batch not found' });
  res.json(summarizeBatch(batch));
});

batchRouter.post('/:batchId/cancel', (req, res) => {
  const batch = cancelBatch(req.params.batchId);
  if (!batch) return res.status(404).json({ error: 'batch not found' });
  res.json(summarizeBatch(batch));
});

batchRouter.get('/:batchId/stream', (req, res) => {
  const { batchId } = req.params;
  if (!getBatch(batchId)) {
    return res.status(404).json({ error: 'batch not found' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {}
  }, 15000);
  if (heartbeat.unref) heartbeat.unref();

  res.on('close', () => clearInterval(heartbeat));

  subscribeToBatch(batchId, res);
});
