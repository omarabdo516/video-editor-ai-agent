import { Router } from 'express';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { getVideo, updateVideoRating } from '../lib/state.mjs';
import { REPO_ROOT } from '../lib/paths.mjs';

export const ratingRouter = Router();

const FEEDBACK_DIR = path.join(REPO_ROOT, 'feedback');
const LOG_FILE = path.join(FEEDBACK_DIR, 'log.json');

function appendFeedbackEntry(video, rating, note) {
  if (!existsSync(FEEDBACK_DIR)) mkdirSync(FEEDBACK_DIR, { recursive: true });

  let log = { projects: [] };
  if (existsSync(LOG_FILE)) {
    try {
      log = JSON.parse(readFileSync(LOG_FILE, 'utf8'));
      if (!log || !Array.isArray(log.projects)) log = { projects: [] };
    } catch (e) {
      console.warn(`[rating] could not parse log.json: ${e.message}`);
    }
  }

  const entry = {
    project: video.name,
    date: new Date().toISOString().slice(0, 10),
    brand: 'rs',
    source: 'dashboard',
    video_duration_sec: video.duration_sec ?? null,
    overall_rating: rating,
    overall_note: note ?? null,
    feedback: [],
  };
  log.projects.push(entry);
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2) + '\n', 'utf8');
  return entry;
}

// POST /api/videos/:id/rating — body: { rating: 1-5, note? }
ratingRouter.post('/:id/rating', (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });

  const { rating, note } = req.body || {};
  const r = Number(rating);
  if (!Number.isFinite(r) || r < 1 || r > 5) {
    return res
      .status(400)
      .json({ error: 'rating must be a number between 1 and 5' });
  }

  const updated = updateVideoRating(video.id, { rating: r, note });
  const entry = appendFeedbackEntry(updated, r, note);

  res.json({ video: updated, entry });
});
