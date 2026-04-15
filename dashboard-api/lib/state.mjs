// Persisted dashboard state: `dashboard-api/state/videos.json`.
//
// Loaded once at startup into an in-memory object; every mutation rewrites
// the whole file synchronously. The file is small (one entry per tracked
// video) so this is simpler than any incremental strategy and robust
// against crashes.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';
import { derivedOutputs, videoBasename } from './paths.mjs';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_DIR = path.resolve(__dirname, '..', 'state');
const STATE_FILE = path.join(STATE_DIR, 'videos.json');

const FFPROBE = 'C:/ffmpeg/bin/ffprobe.exe';

const PHASE_KEYS = [
  'phase1',
  'transcribe',
  'edit',
  'analyze',
  'microEvents',
  'render',
];

function emptyPhases() {
  const out = {};
  for (const k of PHASE_KEYS) out[k] = { status: 'pending' };
  return out;
}

// ─── in-memory cache ──────────────────────────────────────────────────────
let cache = null;

export function loadState() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  if (!existsSync(STATE_FILE)) {
    cache = { videos: [] };
    persist();
    return cache;
  }
  try {
    const raw = readFileSync(STATE_FILE, 'utf8');
    cache = JSON.parse(raw);
    if (!cache || !Array.isArray(cache.videos)) cache = { videos: [] };
  } catch (e) {
    console.warn(`[state] failed to parse ${STATE_FILE}: ${e.message} — starting fresh`);
    cache = { videos: [] };
  }
  return cache;
}

function persist() {
  if (!cache) cache = { videos: [] };
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

function ensureLoaded() {
  if (!cache) loadState();
  return cache;
}

// ─── reads ────────────────────────────────────────────────────────────────
export function getVideos() {
  return ensureLoaded().videos;
}

export function getVideo(id) {
  return ensureLoaded().videos.find((v) => v.id === id) || null;
}

// ─── id generation ────────────────────────────────────────────────────────
function slugify(name) {
  if (!name) return 'video';
  // Arabic and other non-ASCII chars get stripped — session 2 picks
  // uniqueness over readability.
  const ascii = name
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return ascii || 'video';
}

function uniqueId(base) {
  const existing = new Set(getVideos().map((v) => v.id));
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ─── duration via ffprobe ─────────────────────────────────────────────────
function probeDuration(videoPath) {
  try {
    const res = spawnSync(
      FFPROBE,
      [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'default=nw=1:nk=1',
        videoPath,
      ],
      { encoding: 'utf8', shell: false },
    );
    if (res.status !== 0) return null;
    const v = parseFloat((res.stdout || '').trim());
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

// ─── writes ───────────────────────────────────────────────────────────────
export function addVideo({ path: videoPath, name, lecturer, workshop }) {
  ensureLoaded();
  if (!videoPath) throw new Error('path is required');
  try {
    if (!statSync(videoPath).isFile()) throw new Error('not a file');
  } catch (e) {
    throw new Error(`video not found: ${videoPath} (${e.message})`);
  }

  const displayName = name || videoBasename(videoPath);
  const baseId = slugify(displayName);
  const id = uniqueId(baseId === 'video' ? `video-${getVideos().length + 1}` : baseId);

  const duration_sec = probeDuration(videoPath);

  const video = {
    id,
    path: videoPath,
    name: displayName,
    lecturer: lecturer || null,
    workshop: workshop || null,
    addedAt: new Date().toISOString(),
    duration_sec,
    phases: emptyPhases(),
    outputs: derivedOutputs(videoPath),
    rating: null,
    notes: null,
  };

  cache.videos.push(video);
  persist();
  return video;
}

export function updateVideoPhase(id, phase, patch) {
  ensureLoaded();
  const video = cache.videos.find((v) => v.id === id);
  if (!video) return null;
  if (!video.phases) video.phases = emptyPhases();
  if (!video.phases[phase]) video.phases[phase] = { status: 'pending' };
  Object.assign(video.phases[phase], patch);
  persist();
  return video;
}

export function updateVideoRating(id, { rating, note }) {
  ensureLoaded();
  const video = cache.videos.find((v) => v.id === id);
  if (!video) return null;
  video.rating = rating;
  if (note !== undefined) video.notes = note;
  persist();
  return video;
}

export function removeVideo(id) {
  ensureLoaded();
  const idx = cache.videos.findIndex((v) => v.id === id);
  if (idx === -1) return false;
  cache.videos.splice(idx, 1);
  persist();
  return true;
}
