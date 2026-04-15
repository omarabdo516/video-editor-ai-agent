// Builds the Claude handoff message for Phase 5/6 analysis.
//
// The dashboard never invokes Claude directly — it just assembles a
// pre-formatted message that Omar copies into a fresh Claude session.
// Keep this module pure: given a video + derived paths, return the
// text. No filesystem side effects.

import {
  videoBasename,
  captionsPath,
  faceMapPath,
  energyPath,
  speechRhythmPath,
  animationPlanPath,
  contentAnalysisPath,
  REPO_ROOT,
} from './paths.mjs';
import path from 'node:path';

function relToRepo(absPath) {
  const rel = path.relative(REPO_ROOT, absPath);
  if (rel && !rel.startsWith('..')) return rel.split(path.sep).join('/');
  return absPath.split(path.sep).join('/');
}

function fmtDuration(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')} (${sec.toFixed(1)}s)`;
}

export function buildHandoffMessage(video) {
  const slug = videoBasename(video.path);
  const lecturer = video.lecturer || 'محاضر';
  const workshop = video.workshop || 'RS Hero workshop';
  const duration = fmtDuration(video.duration_sec);

  const captions = captionsPath(video.path);
  const faceMap = faceMapPath(video.path);
  const energy = energyPath(video.path);
  const speechRhythm = speechRhythmPath(video.path);
  const contentAnalysis = contentAnalysisPath(video.path);
  const animationPlan = animationPlanPath(video.path);

  return [
    `اشتغل على فيديو "${video.name}".`,
    '',
    `الـ video path: ${video.path}`,
    `المحاضر: ${lecturer}`,
    `الورشة: ${workshop}`,
    `المدة: ${duration}`,
    '',
    'الـ files الجاهزة:',
    `- captions: ${captions}`,
    `- face_map: ${faceMap}`,
    `- energy: ${energy}`,
    `- speech_rhythm: ${speechRhythm}`,
    '',
    'المطلوب:',
    `1. Phase 5 — content analysis → ${relToRepo(contentAnalysis)}`,
    `2. Phase 6 — animation plan → ${relToRepo(animationPlan)}`,
    `3. Phase 6.5 — node scripts/generate_micro_events.mjs "${slug}"`,
    `4. اعمل validation: node scripts/validate_plan.mjs "${slug}"`,
    '5. لما تخلص، ارجع للـ Dashboard على localhost:5174 ودوس "Render"',
    '',
    'قواعد مهمة (اقرأ CLAUDE.md + brands/rs/BRAND.md + feedback/style_evolution.md قبل أي تعديل):',
    '- 15s spacing بين الـ scenes (مش 45)',
    '- single caption style للريل كله (hormozi) — ما تخلطش',
    '- scene count بيتحدد من الـ content، مش من cap ثابت',
    '- بعد ما تحفظ animation_plan.json، ارجع هنا ودوس Render',
  ].join('\n');
}
