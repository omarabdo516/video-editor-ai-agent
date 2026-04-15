import { Router } from 'express';
import { subscribeToJob, getJob } from '../lib/jobs.mjs';

export const progressRouter = Router();

// GET /api/progress/:jobId — Server-Sent Events stream.
//
// Emits three event types:
//   event: line   data: {"text":"..."}
//   event: done   data: {"exitCode":0,"status":"done"}
//   event: error  data: {"message":"..."}
//
// Buffered lines from the job are replayed on connect so clients that
// subscribe mid-run still see the scrollback.
progressRouter.get('/:jobId', (req, res) => {
  const { jobId } = req.params;

  if (!getJob(jobId)) {
    return res.status(404).json({ error: 'job not found' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  // Heartbeat to keep the connection alive through proxies/idle timeouts.
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {}
  }, 15000);
  if (heartbeat.unref) heartbeat.unref();

  res.on('close', () => clearInterval(heartbeat));

  subscribeToJob(jobId, res);
});

// Convenience — peek at a job's final state without streaming.
progressRouter.get('/:jobId/summary', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'job not found' });
  res.json({
    id: job.id,
    videoId: job.videoId,
    phase: job.phase,
    status: job.status,
    exitCode: job.exitCode,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    lines: job.lines,
  });
});
