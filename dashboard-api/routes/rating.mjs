import { Router } from 'express';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { getVideo, updateVideoRating } from '../lib/state.mjs';
import { REPO_ROOT, animationPlanPath } from '../lib/paths.mjs';

export const ratingRouter = Router();

const FEEDBACK_DIR = path.join(REPO_ROOT, 'feedback');
const LOG_FILE = path.join(FEEDBACK_DIR, 'log.json');

function readLog() {
  if (!existsSync(LOG_FILE)) return { projects: [] };
  try {
    const parsed = JSON.parse(readFileSync(LOG_FILE, 'utf8'));
    if (!parsed || !Array.isArray(parsed.projects)) return { projects: [] };
    return parsed;
  } catch (e) {
    console.warn(`[rating] could not parse log.json: ${e.message}`);
    return { projects: [] };
  }
}

function writeLog(log) {
  if (!existsSync(FEEDBACK_DIR)) mkdirSync(FEEDBACK_DIR, { recursive: true });
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2) + '\n', 'utf8');
}

// Reads the animation_plan.json if it exists and returns the same counts
// shape that Omar's previous manual entries use.
function countsFromAnimationPlan(video) {
  const p = animationPlanPath(video.path);
  if (!existsSync(p)) return null;
  try {
    const plan = JSON.parse(readFileSync(p, 'utf8'));
    const scenes = Array.isArray(plan.scenes) ? plan.scenes.length : 0;
    const zooms = Array.isArray(plan.smart_zoom_plan?.moments)
      ? plan.smart_zoom_plan.moments.length
      : 0;
    const overlays = Array.isArray(plan.overlays) ? plan.overlays.length : 0;
    const micro = Array.isArray(plan.micro_events) ? plan.micro_events : [];
    const byType = (t) => micro.filter((e) => e && e.type === t).length;
    return {
      scenes,
      smart_zooms: zooms,
      big_overlays: overlays,
      micro_events: micro.length,
      word_pop: byType('word_pop'),
      caption_underline: byType('caption_underline'),
      mini_zoom: byType('mini_zoom'),
      accent_flash: byType('accent_flash'),
      total_events: zooms + overlays + micro.length,
    };
  } catch (e) {
    console.warn(`[rating] could not read animation_plan: ${e.message}`);
    return null;
  }
}

// Upsert behavior:
// - If a project entry with the same `project` name exists, update its
//   overall_rating + overall_note in place (keeping its feedback[] intact
//   so Omar's hand-written notes are never clobbered).
// - Otherwise append a fresh entry with minimal metadata.
function upsertFeedbackEntry(video, rating, note) {
  const log = readLog();
  const existing = log.projects.find((p) => p && p.project === video.name);

  if (existing) {
    existing.overall_rating = rating;
    if (note !== undefined) existing.overall_note = note ?? null;
    existing.last_updated = new Date().toISOString().slice(0, 10);
    existing.source = existing.source ?? 'dashboard';
    writeLog(log);
    return existing;
  }

  const counts = countsFromAnimationPlan(video);
  const entry = {
    project: video.name,
    date: new Date().toISOString().slice(0, 10),
    brand: 'rs',
    source: 'dashboard',
    video_duration_sec: video.duration_sec ?? null,
    ...(counts ? { counts } : {}),
    overall_rating: rating,
    overall_note: note ?? null,
    feedback: [],
  };
  log.projects.push(entry);
  writeLog(log);
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
  const entry = upsertFeedbackEntry(updated, r, note);

  res.json({ video: updated, entry });
});
