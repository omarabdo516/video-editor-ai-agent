import { Router } from 'express';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  getVideos,
  getVideo,
  addVideo,
  removeVideo,
  updateVideo,
  getCategories,
} from '../lib/state.mjs';
import { parseVideoName } from '../lib/parseName.mjs';
import {
  videoBasename,
  thumbnailPath,
  ensurePipelineDir,
  REPO_ROOT,
} from '../lib/paths.mjs';

const FFMPEG = 'C:/ffmpeg/bin/ffmpeg.exe';

export const videosRouter = Router();

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm']);

videosRouter.get('/', (_req, res) => {
  res.json({ videos: getVideos() });
});

// Must be before /:id routes so Express doesn't match "categories" as an id
videosRouter.get('/categories', (_req, res) => {
  res.json({ categories: getCategories() });
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

// ─── Update video metadata (category, name, lecturer, workshop) ────────
// PATCH /api/videos/:id — Body: { category?: string, name?: string, ... }
videosRouter.patch('/:id', (req, res) => {
  const video = updateVideo(req.params.id, req.body || {});
  if (!video) return res.status(404).json({ error: 'video not found' });
  res.json({ video });
});

// ─── Thumbnail — on-demand generation + cache ──────────────────────────
// GET /api/videos/:id/thumbnail → JPEG image (320px wide, ~5s into video)
videosRouter.get('/:id/thumbnail', async (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });

  // Determine source: use scaled video if it exists, else original
  const sourcePath = existsSync(video.path) ? video.path : null;
  if (!sourcePath) {
    return res.status(404).json({ error: 'source video not found on disk' });
  }

  const thumbPath = thumbnailPath(video.path);

  // Serve cached thumbnail if it exists
  if (existsSync(thumbPath)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(path.resolve(thumbPath));
  }

  // Generate thumbnail (async to avoid blocking the event loop)
  function runFfmpeg(seekSec) {
    return new Promise((resolve) => {
      const proc = spawn(FFMPEG, [
        '-ss', String(seekSec),
        '-i', sourcePath,
        '-vframes', '1',
        '-vf', 'scale=320:-1',
        '-q:v', '3',
        '-y',
        thumbPath,
      ], { stdio: 'pipe' });
      const timer = setTimeout(() => { proc.kill(); resolve(false); }, 15000);
      proc.on('close', (code) => { clearTimeout(timer); resolve(code === 0); });
      proc.on('error', () => { clearTimeout(timer); resolve(false); });
    });
  }

  try {
    ensurePipelineDir(video.path);
    let ok = await runFfmpeg(5);
    if (!ok || !existsSync(thumbPath)) {
      ok = await runFfmpeg(0); // retry at 0s for very short videos
    }
    if (!ok || !existsSync(thumbPath)) {
      return res.status(500).json({ error: 'thumbnail generation failed' });
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.resolve(thumbPath));
  } catch (e) {
    res.status(500).json({ error: `thumbnail error: ${e.message}` });
  }
});

// ─── Reflection — Stage α planner output ───────────────────────────────
// GET /api/videos/:id/reflection
// Returns { text } from src/data/<basename>/reflection.txt.
// 404 if the file doesn't exist (video hasn't been planned yet).
videosRouter.get('/:id/reflection', (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });
  const file = path.join(
    REPO_ROOT,
    'src',
    'data',
    videoBasename(video.path),
    'reflection.txt',
  );
  if (!existsSync(file)) {
    return res.status(404).json({ error: 'reflection not available' });
  }
  try {
    const text = readFileSync(file, 'utf8');
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: `reflection read failed: ${e.message}` });
  }
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
