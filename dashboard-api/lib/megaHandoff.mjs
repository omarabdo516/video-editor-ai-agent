// Builds an aggregated Claude handoff message for N videos.
//
// Instead of N separate handoff messages (one per Claude session),
// this packs everything into a single prompt that tells Claude to
// process all videos sequentially in one session. Saves round-trips
// and lets Omar batch-handoff in bulk mode.

import {
  videoBasename,
  captionsPath,
  faceMapPath,
  energyPath,
  speechRhythmPath,
  animationPlanPath,
  contentAnalysisPath,
} from './paths.mjs';

function fmtDuration(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')} (${sec.toFixed(1)}s)`;
}

/**
 * Build a single aggregated message for N videos.
 *
 * @param {Array<{id, name, path, lecturer, workshop, duration_sec}>} videos
 * @returns {string}
 */
export function buildMegaHandoffMessage(videos) {
  if (!videos || videos.length === 0) {
    throw new Error('buildMegaHandoffMessage: videos array is empty');
  }

  const n = videos.length;
  const videoBlocks = videos.map((video, idx) => {
    const slug = videoBasename(video.path);
    const lecturer = video.lecturer || 'محاضر';
    const workshop = video.workshop || 'RS Hero workshop';
    const duration = fmtDuration(video.duration_sec);

    return [
      `### الفيديو ${idx + 1}/${n} — ${video.name}`,
      '',
      `- **path**: \`${video.path}\``,
      `- **المحاضر**: ${lecturer}`,
      `- **الورشة**: ${workshop}`,
      `- **المدة**: ${duration}`,
      `- **slug**: \`${slug}\``,
      '',
      '**الـ files الجاهزة:**',
      `  - captions: ${captionsPath(video.path)}`,
      `  - face_map: ${faceMapPath(video.path)}`,
      `  - energy: ${energyPath(video.path)}`,
      `  - speech_rhythm: ${speechRhythmPath(video.path)}`,
      '',
      '**الـ outputs المطلوبة:**',
      `  - content_analysis → \`${contentAnalysisPath(video.path)}\``,
      `  - animation_plan → \`${animationPlanPath(video.path)}\``,
    ].join('\n');
  }).join('\n\n---\n\n');

  return [
    `# Mega-Batch Phase 5/6 — ${n} فيديو (Mode B: Parallel)`,
    '',
    `اشتغل على الـ ${n} فيديوهات دول **بالتتابع في session واحدة**. لكل فيديو اعمل الـ workflow الكامل قبل ما تنقل للي بعده.`,
    '',
    '## القواعد الإجبارية (اقرأهم مرة واحدة قبل ما تبدأ)',
    '',
    '1. **اقرا CLAUDE.md بالكامل** — فيه current state + قرارات معمارية + الـ pipeline',
    '2. **اقرا brands/rs/BRAND.md** — قواعد البراند الإجبارية',
    '3. **اقرا feedback/style_evolution.md** — تفضيلات Omar المتراكمة',
    '4. **اقرا feedback/reference_library.md** — patterns مستخرجة من reels خارجية. كل entry فيها status (`steal` / `adapt` / `study` / `avoid`). **فكّر فيهم** بعد ما تـ-draft الـ content_analysis. **لما الـ fit واضح ومش forced**، طبّق (1-2 max per reel — أكتر من كده بيـ-حوّل الريل لـ pastiche). **لو مفيش fit مناسب**، اشرح ليه باختصار في الـ plan. الـ `avoid` تأكد إن الـ plan ما يعملش-ـها.',
    '5. **اقرا docs/scene-validation-rules.md** — 15s scene spacing (مش 45)',
    '6. **اقرا docs/phase-5-content-analysis.md + docs/phase-6-animation-planning.md**',
    '',
    '## الـ workflow لكل فيديو (بالترتيب)',
    '',
    '1. **Phase 5**: اقرا captions + energy + face_map + speech_rhythm → اكتب `content_analysis.json`',
    '2. **Phase 6**: اقرا content_analysis.json → اكتب `animation_plan.json`',
    '3. **Phase 6.5**: `node scripts/generate_micro_events.mjs "<slug>"`',
    '4. **Validation**: `node scripts/validate_plan.mjs "<slug>"` — لازم تعدي',
    '5. انتقل للفيديو اللي بعده',
    '',
    '## قواعد المشاركة عبر الـ batch',
    '',
    '- كل فيديو مستقل — **ما تعملش cross-video referencing** (مش نفس الـ reel)',
    '- **single caption style لكل فيديو** (hormozi default)',
    '- **scene count content-driven** — ما تضعش cap على عدد الـ scenes',
    '- **15s spacing** بين scenes في نفس الـ reel',
    '- لو لقيت فيديو مدته أقل من 90s والـ face confidence مش مستقر، استخدم single big zoom + mini zooms (per memory)',
    '',
    '## الفيديوهات',
    '',
    videoBlocks,
    '',
    '---',
    '',
    '## بعد ما تخلص الـ ' + n + ' فيديوهات',
    '',
    'قولي "خلصت الـ batch" وبعدها ارجع للـ Dashboard على `http://localhost:5174` (أو الـ port اللي الـ launcher فتحه) واضغط:',
    '1. **"Render All"** على الـ selected videos — هيشغّل batch render sequential',
    '2. **"Rate & Commit Batch"** بعد ما الـ renders كلها تخلص — هيجمع الـ ratings ويعمل auto-commit',
    '',
    'الـ Dashboard هيـ poll الـ animation_plan.json لكل فيديو فبيعرف تلقائياً لما يخلصوا.',
  ].join('\n');
}
