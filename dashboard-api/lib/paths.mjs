// Per-video file-path helpers. Mirrors the naming conventions used by
// rs-reels.mjs so the dashboard can report output locations without
// re-implementing the pipeline.

import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// repo root = dashboard-api/.. (one level up from lib/)
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

export function stripExt(p) {
  return p.replace(/\.[^.]+$/, '');
}

export function videoBasename(videoPath) {
  return path.basename(videoPath, path.extname(videoPath));
}

export function scaledVideoPath(videoPath) {
  return stripExt(videoPath) + '.1080x1920.mp4';
}

export function wavPath(videoPath) {
  return stripExt(videoPath) + '.16k.wav';
}

export function captionsPath(videoPath) {
  return videoPath + '.captions.json';
}

export function captionsRawPath(videoPath) {
  return videoPath + '.captions.raw.json';
}

export function metadataPath(videoPath) {
  return scaledVideoPath(videoPath) + '.metadata.json';
}

export function faceMapPath(videoPath) {
  return scaledVideoPath(videoPath) + '.face_map.json';
}

export function energyPath(videoPath) {
  return wavPath(videoPath) + '.energy.json';
}

export function animationPlanPath(videoPath) {
  return path.join(REPO_ROOT, 'src', 'data', videoBasename(videoPath), 'animation_plan.json');
}

export function contentAnalysisPath(videoPath) {
  return path.join(REPO_ROOT, 'src', 'data', videoBasename(videoPath), 'content_analysis.json');
}

export function reelOutputPath(videoPath) {
  return stripExt(videoPath) + '-reel.mp4';
}

export function derivedOutputs(videoPath) {
  return {
    raw_captions: captionsRawPath(videoPath),
    captions: captionsPath(videoPath),
    animation_plan: animationPlanPath(videoPath),
    content_analysis: contentAnalysisPath(videoPath),
    reel: reelOutputPath(videoPath),
  };
}
