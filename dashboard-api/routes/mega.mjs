// Mega-batch routes (Mode B: Parallel / all-at-once).
//
// The Dashboard's existing /api/batch endpoints let Omar run a single
// phase on many videos. Mode B layers on top of that: aggregated
// Claude handoff + atomic commit that bundles ratings + context
// updates in one shot.
//
// Routes mounted under /api/mega:
//   POST /api/mega/handoff-all   body: { videoIds } →
//                                { message, videos, count }
//   POST /api/mega/commit-batch  body: { videoIds, batchNote? } →
//                                { commitHash, message, stagedFiles }
//
// The Prep All + Render All actions reuse the existing
// /api/batch/:phase endpoints from Session 5 — no new backend route.

import { Router } from 'express';
import { getVideo } from '../lib/state.mjs';
import { buildMegaHandoffMessage } from '../lib/megaHandoff.mjs';
import { runMegaCommit } from '../lib/megaCommit.mjs';

export const megaRouter = Router();

// ─── /handoff-all ────────────────────────────────────────────────────────
megaRouter.post('/handoff-all', (req, res) => {
  const { videoIds } = req.body || {};
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'videoIds array is required and non-empty' });
  }

  const videos = [];
  const missing = [];
  for (const id of videoIds) {
    const v = getVideo(id);
    if (!v) {
      missing.push(id);
      continue;
    }
    videos.push(v);
  }
  if (missing.length > 0) {
    return res.status(404).json({
      error: `unknown video ids: ${missing.join(', ')}`,
    });
  }

  try {
    const message = buildMegaHandoffMessage(videos);
    res.json({
      message,
      count: videos.length,
      videos: videos.map((v) => ({
        id: v.id,
        name: v.name,
        path: v.path,
        lecturer: v.lecturer,
        workshop: v.workshop,
        duration_sec: v.duration_sec,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── /commit-batch ───────────────────────────────────────────────────────
megaRouter.post('/commit-batch', (req, res) => {
  const { videoIds, batchNote } = req.body || {};
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'videoIds array is required and non-empty' });
  }

  try {
    const result = runMegaCommit(videoIds, { batchNote });
    res.json(result);
  } catch (e) {
    // Detailed 400 so the UI can surface a good error (e.g. "videos
    // without a rating: X, Y — Rate them first.").
    res.status(400).json({ error: e.message });
  }
});
