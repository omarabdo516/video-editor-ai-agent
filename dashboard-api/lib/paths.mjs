// Per-video file-path helpers. Thin wrapper over the canonical
// lib/paths.mjs at the repo root — kept as a separate file only so
// dashboard-api imports can stay relative (`./lib/paths.mjs`) without
// having to know the repo layout.
//
// IMPORTANT: this module must NEVER diverge from the root lib/paths.mjs.
// All shared helpers are re-exported verbatim below; anything that's
// dashboard-api-specific (REPO_ROOT resolution, animation_plan/content
// paths under src/data/) stays here.

import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// repo root = dashboard-api/.. (one level up from lib/)
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Re-export the canonical helpers so every import site gets the same
// path logic (new _pipeline/ layout + Output/ folder + legacy fallback).
export {
  stripExt,
  videoBasename,
  videoDir,
  pipelineDir,
  outputDir,
  ensurePipelineDir,
  ensureOutputDir,
  scaledVideoPath,
  wavPath,
  metadataPath,
  faceMapPath,
  energyPath,
  captionsPath,
  captionsRawPath,
  captionsSrtPath,
  speechRhythmPath,
  reelOutputPath,
  legacyCandidates,
  canonicalPath,
  resolveExisting,
  pendingMigrations,
  migrateFile,
} from '../../lib/paths.mjs';

// Local: these live inside src/data/ under the repo, not next to the
// source video, so they stay here rather than in the root helpers.
import { videoBasename as _videoBasename } from '../../lib/paths.mjs';

export function animationPlanPath(videoPath) {
  return path.join(REPO_ROOT, 'src', 'data', _videoBasename(videoPath), 'animation_plan.json');
}

export function contentAnalysisPath(videoPath) {
  return path.join(REPO_ROOT, 'src', 'data', _videoBasename(videoPath), 'content_analysis.json');
}

// derivedOutputs is dashboard-specific because it includes the
// animation_plan + content_analysis paths (which live in src/data/,
// not in _pipeline/).
import {
  captionsRawPath as _raw,
  captionsPath as _caps,
  captionsSrtPath as _srt,
  scaledVideoPath as _scaled,
  wavPath as _wav,
  faceMapPath as _face,
  energyPath as _energy,
  metadataPath as _meta,
  speechRhythmPath as _rhythm,
  reelOutputPath as _reel,
} from '../../lib/paths.mjs';

export function derivedOutputs(videoPath) {
  return {
    raw_captions: _raw(videoPath),
    captions: _caps(videoPath),
    captions_srt: _srt(videoPath),
    scaled: _scaled(videoPath),
    wav: _wav(videoPath),
    face_map: _face(videoPath),
    energy: _energy(videoPath),
    metadata: _meta(videoPath),
    speech_rhythm: _rhythm(videoPath),
    animation_plan: animationPlanPath(videoPath),
    content_analysis: contentAnalysisPath(videoPath),
    reel: _reel(videoPath),
  };
}
