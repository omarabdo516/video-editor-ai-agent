// Canonical per-video path helpers. Single source of truth for where
// every intermediate + final file lives.
//
// Layout (April 2026 reorg):
//
//   <video-dir>/
//     <source>.mp4                                 ← source (visible)
//     _pipeline/                                   ← all intermediates
//       <basename>/
//         scaled.1080x1920.mp4
//         scaled.1080x1920.mp4.metadata.json
//         scaled.1080x1920.mp4.face_map.json
//         audio.16k.wav
//         audio.16k.wav.energy.json
//         captions.json
//         captions.raw.json       (Phase 11 session 1 snapshot)
//         captions.srt
//         speech_rhythm.json
//     Output/                                      ← final reels
//       <basename>-reel.mp4
//
// Rationale: the old flat layout (~10 files per video next to the
// source) made Omar's working folder unusable once a batch of 5+
// videos went through. Everything the pipeline creates gets hidden
// inside _pipeline/ (underscore sorts first in Windows Explorer)
// except the final reel, which moves to Output/ so it's discoverable
// without opening a subfolder.
//
// Filenames inside the pipeline folder DROP the video basename as a
// prefix (since the folder is already named after it). They also
// KEEP their informative suffixes (e.g. `.1080x1920.mp4.face_map.json`
// instead of just `face_map.json`) so the relationship between
// each derived file and its source stays readable.
//
// Imported from:
//   - rs-reels.mjs (the CLI pipeline)
//   - dashboard-api/lib/paths.mjs (thin re-export so Dashboard +
//     CLI share one source of truth)
//
// Both rs-reels.mjs and dashboard-api import from this file directly.
// Do NOT duplicate these functions anywhere else — if you find
// yourself wanting to, add a helper here instead.

import path from 'node:path';
import { existsSync, mkdirSync, renameSync, statSync } from 'node:fs';

// ─── basename + directory helpers ────────────────────────────────────────

/** Strip one extension from a basename. e.g. "foo.mp4" → "foo" */
export function stripExt(p) {
  return p.replace(/\.[^.]+$/, '');
}

/** Video basename without extension. e.g. "<dir>/foo bar.mp4" → "foo bar" */
export function videoBasename(videoPath) {
  return path.basename(videoPath, path.extname(videoPath));
}

/** Directory holding the source video. */
export function videoDir(videoPath) {
  return path.dirname(videoPath);
}

/** Per-video pipeline subfolder:  <video-dir>/_pipeline/<basename>/ */
export function pipelineDir(videoPath) {
  return path.join(videoDir(videoPath), '_pipeline', videoBasename(videoPath));
}

/** Folder holding all final reels:  <video-dir>/Output/ */
export function outputDir(videoPath) {
  return path.join(videoDir(videoPath), 'Output');
}

/** Ensure the per-video pipeline folder exists. Returns the absolute path. */
export function ensurePipelineDir(videoPath) {
  const dir = pipelineDir(videoPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Ensure the Output/ folder exists. Returns the absolute path. */
export function ensureOutputDir(videoPath) {
  const dir = outputDir(videoPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── per-artifact helpers ────────────────────────────────────────────────

/** Pre-scaled 1080x1920 video. */
export function scaledVideoPath(videoPath) {
  return path.join(pipelineDir(videoPath), 'scaled.1080x1920.mp4');
}

/** 16kHz mono WAV (what whisper + librosa consume). */
export function wavPath(videoPath) {
  return path.join(pipelineDir(videoPath), 'audio.16k.wav');
}

/** ffprobe metadata for the scaled video. */
export function metadataPath(videoPath) {
  return scaledVideoPath(videoPath) + '.metadata.json';
}

/** MediaPipe face map for the scaled video. */
export function faceMapPath(videoPath) {
  return scaledVideoPath(videoPath) + '.face_map.json';
}

/** librosa energy/emphasis for the wav. */
export function energyPath(videoPath) {
  return wavPath(videoPath) + '.energy.json';
}

/** Approved captions (what the subtitle editor saves). */
export function captionsPath(videoPath) {
  return path.join(pipelineDir(videoPath), 'captions.json');
}

/** Pre-edit snapshot from the Whisper corrections tracker. */
export function captionsRawPath(videoPath) {
  return path.join(pipelineDir(videoPath), 'captions.raw.json');
}

/** SRT version of the captions (written on Approve in the editor). */
export function captionsSrtPath(videoPath) {
  return path.join(pipelineDir(videoPath), 'captions.srt');
}

/** speech_rhythm.py output (pace / pause classification). */
export function speechRhythmPath(videoPath) {
  return path.join(pipelineDir(videoPath), 'speech_rhythm.json');
}

/** Final rendered reel:  <video-dir>/Output/<basename>-reel.mp4 */
export function reelOutputPath(videoPath) {
  return path.join(outputDir(videoPath), videoBasename(videoPath) + '-reel.mp4');
}

/**
 * All derived outputs for a single video. Used by the Dashboard to
 * surface output paths in the UI and by the mega-commit flow to pick
 * which files to stage.
 */
export function derivedOutputs(videoPath) {
  return {
    raw_captions: captionsRawPath(videoPath),
    captions: captionsPath(videoPath),
    captions_srt: captionsSrtPath(videoPath),
    scaled: scaledVideoPath(videoPath),
    wav: wavPath(videoPath),
    face_map: faceMapPath(videoPath),
    energy: energyPath(videoPath),
    metadata: metadataPath(videoPath),
    speech_rhythm: speechRhythmPath(videoPath),
    reel: reelOutputPath(videoPath),
  };
}

// ─── legacy fallback (reads both new + old layouts) ──────────────────────
//
// Until Omar's existing video folders are migrated, some files still
// live in the old flat layout. `resolveExisting` tries the new
// location first, then a list of legacy candidates, and returns the
// first one that actually exists on disk. Used by the Dashboard's
// filesystem-backed sync (so it reads old-layout files without
// crashing) and by the migration script (so it knows what to move).

/**
 * Legacy path candidates for a given artifact kind. Each entry is an
 * absolute path that might or might not exist. Used for back-compat
 * reads and for the migration script to find files to move.
 */
export function legacyCandidates(videoPath, kind) {
  const dir = videoDir(videoPath);
  const base = videoBasename(videoPath);
  const noExt = path.join(dir, base);
  const withExt = videoPath; // includes .mp4

  switch (kind) {
    case 'scaled':
      return [noExt + '.1080x1920.mp4'];
    case 'wav':
      return [noExt + '.16k.wav'];
    case 'metadata':
      return [noExt + '.1080x1920.mp4.metadata.json'];
    case 'face_map':
      return [noExt + '.1080x1920.mp4.face_map.json'];
    case 'energy':
      return [noExt + '.16k.wav.energy.json'];
    case 'captions':
      return [withExt + '.captions.json'];
    case 'captions_raw':
      return [withExt + '.captions.raw.json'];
    case 'captions_srt':
      return [
        path.join(dir, base + '.srt'),
        withExt + '.captions.srt',
      ];
    case 'speech_rhythm':
      return [withExt + '.speech_rhythm.json'];
    case 'reel':
      return [noExt + '-reel.mp4'];
    default:
      return [];
  }
}

/** Canonical (new) path for a given kind. */
export function canonicalPath(videoPath, kind) {
  switch (kind) {
    case 'scaled':        return scaledVideoPath(videoPath);
    case 'wav':           return wavPath(videoPath);
    case 'metadata':      return metadataPath(videoPath);
    case 'face_map':      return faceMapPath(videoPath);
    case 'energy':        return energyPath(videoPath);
    case 'captions':      return captionsPath(videoPath);
    case 'captions_raw':  return captionsRawPath(videoPath);
    case 'captions_srt':  return captionsSrtPath(videoPath);
    case 'speech_rhythm': return speechRhythmPath(videoPath);
    case 'reel':          return reelOutputPath(videoPath);
    default:              return null;
  }
}

/**
 * Return the first existing path among:
 *   1. The canonical (new) location
 *   2. The legacy candidates
 * If nothing exists, returns the canonical path (so callers that
 * need to CREATE the file still get the right target).
 */
export function resolveExisting(videoPath, kind) {
  const canonical = canonicalPath(videoPath, kind);
  if (canonical && existsSync(canonical)) return canonical;
  for (const legacy of legacyCandidates(videoPath, kind)) {
    if (existsSync(legacy)) return legacy;
  }
  return canonical;
}

/**
 * Used by the migration script: for each artifact kind, return both
 * the legacy location (if it exists) and the target canonical path.
 */
export function pendingMigrations(videoPath) {
  const kinds = [
    'scaled',
    'wav',
    'metadata',
    'face_map',
    'energy',
    'captions',
    'captions_raw',
    'captions_srt',
    'speech_rhythm',
    'reel',
  ];
  const out = [];
  for (const kind of kinds) {
    const canonical = canonicalPath(videoPath, kind);
    if (!canonical) continue;
    // Already in new location — nothing to do
    if (existsSync(canonical)) continue;
    for (const legacy of legacyCandidates(videoPath, kind)) {
      if (existsSync(legacy) && legacy !== canonical) {
        out.push({ kind, from: legacy, to: canonical });
        break; // take the first hit per kind
      }
    }
  }
  return out;
}

/**
 * Move a file atomically into its canonical location, creating the
 * parent directory if needed. Returns true if moved, false if the
 * source doesn't exist (idempotent — calling twice is safe).
 */
export function migrateFile(from, to) {
  if (!existsSync(from)) return false;
  // Sanity — don't clobber an existing target
  if (existsSync(to)) {
    try {
      const fromS = statSync(from);
      const toS = statSync(to);
      // Same inode? already migrated — nothing to do
      if (fromS.ino && toS.ino && fromS.ino === toS.ino) return false;
    } catch {
      // fall through
    }
    // Target exists and is different — skip (caller decides policy)
    return false;
  }
  const parent = path.dirname(to);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  renameSync(from, to);
  return true;
}
