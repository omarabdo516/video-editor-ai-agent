import { Router } from 'express';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  getVideos,
  getVideo,
  addVideo,
  removeVideo,
} from '../lib/state.mjs';
import { parseVideoName } from '../lib/parseName.mjs';
import { videoBasename } from '../lib/paths.mjs';

export const videosRouter = Router();

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm']);

videosRouter.get('/', (_req, res) => {
  res.json({ videos: getVideos() });
});

videosRouter.post('/', (req, res) => {
  const { path: videoPath, name, lecturer, workshop } = req.body || {};
  if (!videoPath) {
    return res.status(400).json({ error: 'path is required' });
  }
  try {
    const video = addVideo({ path: videoPath, name, lecturer, workshop });
    res.status(201).json({ video });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

videosRouter.get('/:id', (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });
  res.json({ video });
});

videosRouter.delete('/:id', (req, res) => {
  const ok = removeVideo(req.params.id);
  if (!ok) return res.status(404).json({ error: 'video not found' });
  res.json({ ok: true });
});

// ─── Preview parse (auto-fill lecturer/workshop in single-add form) ─────
// Body: { path: "D:/foo/bar/<name>.mp4" }
// Returns: { name, lecturer, workshop } — pure string parsing, no disk I/O.
videosRouter.post('/parse', (req, res) => {
  const { path: videoPath } = req.body || {};
  if (!videoPath) return res.status(400).json({ error: 'path is required' });
  try {
    const parsed = parseVideoName(videoBasename(videoPath));
    res.json(parsed);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Scan a folder for videos ────────────────────────────────────────────
// Body: { folderPath: "D:/videos/batch-april", recursive?: boolean }
// Returns: { folder, found: [{ path, basename, suggestedName,
//                              suggestedLecturer, suggestedWorkshop,
//                              alreadyTracked }] }
videosRouter.post('/scan-folder', (req, res) => {
  const { folderPath, recursive = false } = req.body || {};
  if (!folderPath) return res.status(400).json({ error: 'folderPath is required' });

  let stat;
  try {
    stat = statSync(folderPath);
  } catch (e) {
    return res.status(400).json({ error: `folder not found: ${e.message}` });
  }
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: 'folderPath is not a directory' });
  }

  // Build a set of currently-tracked paths so the frontend can grey out
  // videos that are already in the dashboard.
  const trackedPaths = new Set(getVideos().map((v) => path.resolve(v.path)));

  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) continue;
      // Skip derived outputs — e.g. the 1080x1920 pre-scaled versions,
      // -reel.mp4 final renders. These are generated, not source videos.
      if (/\.1080x1920\./i.test(entry.name)) continue;
      if (/-reel\.mp4$/i.test(entry.name)) continue;

      const parsed = parseVideoName(entry.name);
      found.push({
        path: full,
        basename: entry.name,
        suggestedName: parsed.name,
        suggestedLecturer: parsed.lecturer,
        suggestedWorkshop: parsed.workshop,
        alreadyTracked: trackedPaths.has(path.resolve(full)),
      });
    }
  };

  walk(folderPath);

  // Alphabetical so the UI gets a stable order
  found.sort((a, b) => a.basename.localeCompare(b.basename, 'ar'));

  res.json({ folder: folderPath, recursive, found });
});

// ─── Bulk add videos ─────────────────────────────────────────────────────
// Body: { videos: Array<{ path, name?, lecturer?, workshop? }> }
// Returns: { added: Video[], skipped: [{path, reason}], errors: [{path, error}] }
videosRouter.post('/bulk-add', (req, res) => {
  const { videos: inputs } = req.body || {};
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return res.status(400).json({ error: 'videos array is required and non-empty' });
  }

  const trackedPaths = new Set(getVideos().map((v) => path.resolve(v.path)));
  const added = [];
  const skipped = [];
  const errors = [];

  for (const input of inputs) {
    if (!input || !input.path) {
      errors.push({ path: String(input?.path ?? '(empty)'), error: 'path missing' });
      continue;
    }
    if (trackedPaths.has(path.resolve(input.path))) {
      skipped.push({ path: input.path, reason: 'already tracked' });
      continue;
    }
    try {
      const video = addVideo({
        path: input.path,
        name: input.name,
        lecturer: input.lecturer,
        workshop: input.workshop,
      });
      added.push(video);
      trackedPaths.add(path.resolve(input.path));
    } catch (e) {
      errors.push({ path: input.path, error: e.message });
    }
  }

  res.json({ added, skipped, errors });
});
