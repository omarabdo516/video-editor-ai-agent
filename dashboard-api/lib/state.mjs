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
import { derivedOutputs, videoBasename, resolveExisting } from './paths.mjs';
import { parseVideoName } from './parseName.mjs';

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
  // One-shot refresh of each video's `outputs` via derivedOutputs() so
  // stale flat-layout paths persisted before the April 2026 reorg get
  // rewritten to the new _pipeline/ + Output/ canonical paths.
  // Idempotent after the first run on any given videos.json.
  let refreshed = false;
  for (const v of cache.videos) {
    const fresh = derivedOutputs(v.path);
    const current = JSON.stringify(v.outputs || {});
    const next = JSON.stringify(fresh);
    if (current !== next) {
      v.outputs = fresh;
      refreshed = true;
    }
  }
  if (refreshed) {
    console.log('[state] refreshed video outputs to new _pipeline/ layout');
    persist();
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

// ─── filesystem sync: detect Edit phase completion ─────────────────────────
//
// The subtitle editor saves via rs-reels.mjs' file server on :7777, which
// is a completely separate process from the Dashboard API. There's no
// direct signal back to us. Instead, we probe the filesystem:
//
//   - At first transcribe, rs-reels copies captions.json → captions.raw.json
//     (the Whisper corrections tracker from Phase 11 Session 1)
//   - When Omar approves in the subtitle editor, captions.json is
//     rewritten with his edits; captions.raw.json stays untouched
//   - So if captions.json mtime > captions.raw.json mtime + grace,
//     Omar edited it
//
// For older videos that predate the raw.json snapshot, we fall back to
// comparing captions.json mtime against transcribe.finishedAt. Same idea.
//
// Runs on every read. Cheap (just statSync on 2 files per video) and
// keeps the state file in sync with reality without needing a watcher.

const EDIT_DETECT_GRACE_MS = 500;

function mtimeOf(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

function syncEditPhaseFromDisk(video) {
  const edit = video.phases?.edit;
  if (!edit) return false;
  // Already final — don't downgrade.
  if (edit.status === 'done' || edit.status === 'running') return false;

  // Use resolveExisting so both the new _pipeline/ layout and the
  // legacy flat layout return a valid path if the file exists.
  const caps = resolveExisting(video.path, 'captions');
  const capsM = mtimeOf(caps);
  if (capsM == null) return false;

  // Preferred signal: captions.json newer than captions.raw.json.
  const raw = resolveExisting(video.path, 'captions_raw');
  const rawM = mtimeOf(raw);
  if (rawM != null) {
    if (capsM <= rawM + EDIT_DETECT_GRACE_MS) return false;
  } else {
    // Fallback: compare against transcribe.finishedAt (videos from
    // before the corrections tracker landed won't have a raw.json).
    const tsFinished = video.phases?.transcribe?.finishedAt;
    if (!tsFinished) return false;
    const tsM = new Date(tsFinished).getTime();
    if (!Number.isFinite(tsM)) return false;
    if (capsM <= tsM + EDIT_DETECT_GRACE_MS) return false;
  }

  // Edit detected.
  video.phases.edit = {
    ...edit,
    status: 'done',
    finishedAt: new Date(capsM).toISOString(),
    // Marker so routes/UIs can tell this came from passive detection
    // rather than an explicit job.
    source: 'filesystem',
  };
  return true;
}

// If render is done but analyze/microEvents are pending, they must have
// been completed outside the dashboard (Claude session + script). Mark done.
function inferCompletedPhases(video) {
  const phases = video.phases;
  if (!phases || phases.render?.status !== 'done') return false;
  let changed = false;
  for (const p of ['analyze', 'microEvents']) {
    if (phases[p]?.status === 'pending') {
      phases[p] = {
        status: 'done',
        finishedAt: phases.render.finishedAt || new Date().toISOString(),
        source: 'inferred',
      };
      changed = true;
    }
  }
  return changed;
}

// ─── reads ────────────────────────────────────────────────────────────────
export function getVideos() {
  const cache = ensureLoaded();
  let anyChanged = false;
  for (const video of cache.videos) {
    if (syncEditPhaseFromDisk(video)) anyChanged = true;
    if (inferCompletedPhases(video)) anyChanged = true;
  }
  if (anyChanged) persist();
  return cache.videos;
}

export function getVideo(id) {
  const cache = ensureLoaded();
  const video = cache.videos.find((v) => v.id === id);
  if (!video) return null;
  let changed = syncEditPhaseFromDisk(video);
  if (inferCompletedPhases(video)) changed = true;
  if (changed) persist();
  return video;
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

  // Auto-parse lecturer/workshop from the basename if the caller didn't
  // supply them. Omar's naming convention is "<lecturer> - <workshop>"
  // — see lib/parseName.mjs for the full rules.
  let finalLecturer = lecturer ?? null;
  let finalWorkshop = workshop ?? null;
  if (!finalLecturer || !finalWorkshop) {
    const parsed = parseVideoName(videoBasename(videoPath));
    if (!finalLecturer) finalLecturer = parsed.lecturer;
    if (!finalWorkshop) finalWorkshop = parsed.workshop;
  }

  const video = {
    id,
    path: videoPath,
    name: displayName,
    lecturer: finalLecturer,
    workshop: finalWorkshop,
    category: null,
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

export function updateVideo(id, patch) {
  ensureLoaded();
  const video = cache.videos.find((v) => v.id === id);
  if (!video) return null;
  const ALLOWED = ['name', 'lecturer', 'workshop', 'category'];
  for (const key of ALLOWED) {
    if (key in patch) video[key] = patch[key];
  }
  persist();
  return video;
}

export function getCategories() {
  const cache = ensureLoaded();
  const cats = new Set();
  for (const v of cache.videos) {
    if (v.category) cats.add(v.category);
  }
  return [...cats].sort();
}

export function removeVideo(id) {
  ensureLoaded();
  const idx = cache.videos.findIndex((v) => v.id === id);
  if (idx === -1) return false;
  cache.videos.splice(idx, 1);
  persist();
  return true;
}
