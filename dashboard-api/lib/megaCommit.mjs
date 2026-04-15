// Runs an auto-commit at the end of a mega-batch.
//
// Flow (per the "commit cycle" rule from 2026-04-15):
//   1. Update feedback/log.json with each rated video in the batch
//   2. Prepend a batch-summary block to CLAUDE.md's "Next Up" section
//   3. git add specific files (feedback/log.json, CLAUDE.md, each
//      video's src/data/<slug>/ folder)
//   4. git commit with an auto-generated message
//
// Keeps the git work minimal: only touches files we own. Working-tree
// changes the user made elsewhere are preserved but NOT committed.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, videoBasename } from './paths.mjs';
import { getVideo } from './state.mjs';

const CLAUDE_MD = path.join(REPO_ROOT, 'CLAUDE.md');
const FEEDBACK_LOG = path.join(REPO_ROOT, 'feedback', 'log.json');

/**
 * Run git with args, return { code, stdout, stderr }.
 */
function git(args, opts = {}) {
  const res = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: false,
    ...opts,
  });
  return {
    code: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

/**
 * Upsert a project entry in feedback/log.json for a rated video.
 * If an entry with the same project name exists, updates its rating +
 * note + last_updated. Otherwise inserts a new entry with minimal
 * metadata pulled from the video + its animation_plan.json.
 */
function upsertFeedbackEntry(log, video) {
  if (!log.projects) log.projects = [];
  const name = video.name;
  const date = new Date().toISOString().slice(0, 10);

  const existing = log.projects.find((p) => p.project === name);
  if (existing) {
    existing.overall_rating = video.rating;
    if (video.notes) existing.overall_note = video.notes;
    existing.last_updated = date;
    return { action: 'updated', entry: existing };
  }

  // Pull counts from the animation plan if it exists
  const planPath = path.join(REPO_ROOT, 'src', 'data', videoBasename(video.path), 'animation_plan.json');
  let counts = {};
  if (existsSync(planPath)) {
    try {
      const plan = JSON.parse(readFileSync(planPath, 'utf8'));
      const zooms = plan.smart_zoom_plan?.moments ?? [];
      const microEvents = plan.micro_events ?? [];
      counts = {
        scenes: (plan.scenes ?? []).length,
        smart_zooms: zooms.length,
        big_zooms: zooms.filter((m) => m.zoomLevel >= 1.3).length,
        mini_zooms: zooms.filter((m) => m.zoomLevel < 1.3).length,
        overlays: (plan.overlays ?? []).length,
        micro_events: microEvents.length,
        word_pop: microEvents.filter((e) => e.type === 'word_pop').length,
        caption_underline: microEvents.filter((e) => e.type === 'caption_underline').length,
        accent_flash: microEvents.filter((e) => e.type === 'accent_flash').length,
        chapter_dividers: (plan.chapter_dividers ?? []).length,
      };
    } catch (e) {
      console.warn(`[mega-commit] couldn't read ${planPath}: ${e.message}`);
    }
  }

  const entry = {
    project: name,
    date,
    template_used: null,
    brand: 'rs',
    video_duration_sec: video.duration_sec,
    pipeline: {
      phase_1: 'done (via dashboard)',
      phase_2: 'done (faster-whisper + unicode fix)',
      phase_3: 'approved in subtitle editor',
      phase_5: 'auto (Claude Code in-context, mega-batch Mode B)',
      phase_6: 'auto (Claude Code in-context, mega-batch Mode B)',
      phase_6_5_micro_events: 'auto (scripts/generate_micro_events.mjs)',
      phase_8: 'full render (via dashboard)',
    },
    counts,
    overall_rating: video.rating,
    overall_note: video.notes || null,
    feedback: [],
  };
  log.projects.push(entry);
  return { action: 'created', entry };
}

/**
 * Prepend a batch summary block to CLAUDE.md's Next Up section. Does
 * NOT rewrite the whole file — just inserts a short `> **batch**`
 * blockquote right after the existing "> **آخر تحديث**" line.
 */
function appendBatchSummary(videos, commitDate) {
  if (!existsSync(CLAUDE_MD)) return;
  let text = readFileSync(CLAUDE_MD, 'utf8');

  const n = videos.length;
  const avgRating = videos.reduce((s, v) => s + (v.rating || 0), 0) / n;
  const ratingLine = videos
    .map((v) => `${v.name} (${v.rating ?? '?'}/5)`)
    .join(' · ');

  const block = [
    '>',
    `> **Mega-batch Mode B على ${commitDate}**: rendered ${n} reels بـ avg rating ${avgRating.toFixed(1)}/5 — ${ratingLine}. Commit تلقائي عبر الـ Dashboard mega-batch workflow (Session 1: Prep All → Edit (يدوي) → Send All to Claude → Render All → Rate & Commit). الـ feedback/log.json اتحدّث بالـ ratings + counts من animation_plan.json لكل فيديو.`,
  ].join('\n');

  // Insert the block right after the first line that starts with
  // "> **آخر تحديث:**". If not found, prepend to the file.
  const marker = /(^> \*\*آخر تحديث[^\n]*\n)/m;
  if (marker.test(text)) {
    text = text.replace(marker, `$1${block}\n`);
  } else {
    text = block + '\n\n' + text;
  }
  writeFileSync(CLAUDE_MD, text, 'utf8');
}

/**
 * Run the full mega-batch commit. Takes a list of video IDs, reads
 * their state (including ratings), writes all the side-files, and
 * creates a git commit.
 *
 * @param {string[]} videoIds
 * @param {{ batchNote?: string }} [opts]
 * @returns {{ commitHash: string, message: string, stagedFiles: string[], feedbackUpdates: Array }}
 */
export function runMegaCommit(videoIds, opts = {}) {
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    throw new Error('runMegaCommit: videoIds is empty');
  }

  // 1. Load + validate videos (all must have a rating)
  const videos = [];
  const missingRatings = [];
  for (const id of videoIds) {
    const v = getVideo(id);
    if (!v) throw new Error(`video not found: ${id}`);
    if (v.rating == null) missingRatings.push(v.name);
    videos.push(v);
  }
  if (missingRatings.length > 0) {
    throw new Error(
      `videos without a rating: ${missingRatings.join(', ')}. Rate them first.`,
    );
  }

  // 2. Update feedback/log.json
  let log = { projects: [] };
  if (existsSync(FEEDBACK_LOG)) {
    try {
      log = JSON.parse(readFileSync(FEEDBACK_LOG, 'utf8'));
    } catch (e) {
      console.warn(`[mega-commit] couldn't parse feedback/log.json: ${e.message}`);
      log = { projects: [] };
    }
  }
  const feedbackUpdates = videos.map((v) => upsertFeedbackEntry(log, v));
  writeFileSync(FEEDBACK_LOG, JSON.stringify(log, null, 2) + '\n', 'utf8');

  // 3. Append batch summary to CLAUDE.md
  const commitDate = new Date().toISOString().slice(0, 10);
  appendBatchSummary(videos, commitDate);

  // 4. Stage specific files — each video's src/data/<slug>/ folder
  //    plus the two side-files above. Don't sweep up unrelated changes.
  const stagedFiles = ['feedback/log.json', 'CLAUDE.md'];
  for (const v of videos) {
    const slug = videoBasename(v.path);
    const dataDir = path.join('src', 'data', slug);
    const absDataDir = path.join(REPO_ROOT, dataDir);
    if (existsSync(absDataDir)) {
      stagedFiles.push(dataDir);
    }
  }

  const addRes = git(['add', '--', ...stagedFiles]);
  if (addRes.code !== 0) {
    throw new Error(`git add failed: ${addRes.stderr}`);
  }

  // 5. Commit
  const avgRating = (videos.reduce((s, v) => s + v.rating, 0) / videos.length).toFixed(1);
  const ratingSummary = videos
    .map((v) => `  - ${v.name}: ${v.rating}/5${v.notes ? ` — ${v.notes}` : ''}`)
    .join('\n');

  const commitMessage = [
    `mega-batch: ${videos.length} reels (avg ${avgRating}/5)`,
    '',
    'Auto-committed by the Dashboard mega-batch workflow (Mode B:',
    'Parallel). All videos went through the full pipeline end-to-end:',
    'Phase 1 + Transcribe (batch) → manual Edit → Claude Phase 5/6',
    '(single session) → batch Render → per-video rating → this commit.',
    '',
    'Ratings:',
    ratingSummary,
    '',
    opts.batchNote ? `Batch note: ${opts.batchNote}` : '',
    '',
    'Context updates bundled per the 2026-04-15 commit rule:',
    '  - feedback/log.json upserted (one entry per video, counts from',
    '    animation_plan.json)',
    '  - CLAUDE.md Next Up section prepended with the batch summary',
    '  - src/data/<slug>/ folders staged for each video',
    '',
    'Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>',
  ]
    .filter(Boolean)
    .join('\n');

  const commitRes = git(['commit', '-m', commitMessage]);
  if (commitRes.code !== 0) {
    throw new Error(`git commit failed: ${commitRes.stderr || commitRes.stdout}`);
  }

  // 6. Get the commit hash
  const hashRes = git(['rev-parse', 'HEAD']);
  const commitHash = (hashRes.stdout || '').trim().slice(0, 7);

  return {
    commitHash,
    message: commitMessage,
    stagedFiles,
    feedbackUpdates,
  };
}
