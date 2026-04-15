#!/usr/bin/env node
/**
 * diff_captions.mjs — Compare raw Whisper output against user-edited
 * captions and append word-level corrections to
 * feedback/whisper_corrections.jsonl for future Whisper fine-tuning.
 *
 * Usage:
 *   node scripts/diff_captions.mjs <raw.json> <edited.json> [--project "name"]
 *
 * Algorithm (greedy, timing-anchored):
 *   For each word in the raw stream, find the closest unclaimed edited
 *   word whose start time is within ±0.2s. If the pair exists and the
 *   normalized texts differ, log it. Pure timing shifts and
 *   punctuation-only / diacritic-only changes are skipped — they're not
 *   dialect signal.
 *
 * Each JSONL entry:
 *   {"original":"...","corrected":"...","context_before":"...",
 *    "context_after":"...","time_sec":45.2,"project":"<basename>",
 *    "date":"YYYY-MM-DD"}
 *
 * Exit codes: 0 success · 1 error · 2 missing/bad args or input files.
 */

import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..');

const TIMING_TOLERANCE_SEC = 0.2;
const LOG_PATH = path.join(REPO, 'feedback', 'whisper_corrections.jsonl');
const LOG_HEADER =
  '# Whisper → Approved corrections log. Append-only. Format: JSONL. Each line = one word-level correction.\n';

// Arabic diacritics (U+064B..U+065F), superscript alef (U+0670), tatweel
// (U+0640), plus common Arabic + Latin punctuation. When comparing two
// words we strip these — a punctuation-only or diacritic-only diff is not
// a dialect correction and would pollute the fine-tuning set.
const STRIP_RE = /[\u064B-\u065F\u0670\u0640.,،؛؟?!…"'“”‘’()\[\]{}<>:;\-—–_/\\]/g;

function usage() {
  console.log(
    `Usage: node scripts/diff_captions.mjs <raw.json> <edited.json> [--project "name"]

Compares a raw Whisper captions.json against a user-edited captions.json
and appends word-level corrections to feedback/whisper_corrections.jsonl.

Options:
  --project <name>   Label for this project in the log (defaults to the
                     edited file's basename with .mp4/.captions stripped).
  --help, -h         Show this help.

Exit: 0 success · 1 parse/runtime error · 2 missing args or input files.`,
  );
}

function parseArgs(argv) {
  const positional = [];
  let project = null;
  let help = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      help = true;
      continue;
    }
    if (a === '--project') {
      project = argv[++i] ?? null;
      continue;
    }
    positional.push(a);
  }
  return { positional, project, help };
}

function normalize(word) {
  return (word || '').replace(STRIP_RE, '').trim();
}

function flattenWords(captions) {
  const out = [];
  for (const seg of captions?.segments || []) {
    for (const w of seg?.words || []) {
      if (!w || typeof w.word !== 'string') continue;
      out.push({
        word: w.word,
        start: Number(w.start) || 0,
        end: Number(w.end) || 0,
      });
    }
  }
  return out;
}

function greedyAlign(raw, edited) {
  const corrections = [];
  const consumed = new Set();
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    let bestJ = -1;
    let bestDelta = Infinity;
    for (let j = 0; j < edited.length; j++) {
      if (consumed.has(j)) continue;
      // Small optimization: edited words are roughly sorted, so bail early
      // once we're past the tolerance window on the right side.
      if (edited[j].start - r.start > TIMING_TOLERANCE_SEC && bestJ >= 0) break;
      const delta = Math.abs(edited[j].start - r.start);
      if (delta > TIMING_TOLERANCE_SEC) continue;
      if (delta < bestDelta) {
        bestDelta = delta;
        bestJ = j;
      }
    }
    if (bestJ < 0) continue;
    consumed.add(bestJ);

    const rawText = normalize(r.word);
    const editedText = normalize(edited[bestJ].word);
    if (!rawText || !editedText) continue;
    if (rawText === editedText) continue;

    const before = i > 0 ? normalize(raw[i - 1].word) : '';
    const after = i < raw.length - 1 ? normalize(raw[i + 1].word) : '';
    corrections.push({
      original: rawText,
      corrected: editedText,
      context_before: before,
      context_after: after,
      time_sec: Number(r.start.toFixed(2)),
    });
  }
  return corrections;
}

function deriveProjectLabel(editedPath) {
  return path
    .basename(editedPath)
    .replace(/\.mp4\.captions\.json$/, '')
    .replace(/\.captions\.json$/, '')
    .replace(/\.mp4$/, '');
}

function main() {
  const { positional, project: projectFlag, help } = parseArgs(process.argv);

  if (help || process.argv.length <= 2) {
    usage();
    process.exit(0);
  }
  if (positional.length < 2) {
    usage();
    process.exit(2);
  }

  const [rawPath, editedPath] = positional.map((p) => path.resolve(p));
  if (!existsSync(rawPath)) {
    console.error(`diff_captions: raw file not found: ${rawPath}`);
    process.exit(2);
  }
  if (!existsSync(editedPath)) {
    console.error(`diff_captions: edited file not found: ${editedPath}`);
    process.exit(2);
  }

  let rawCaptions;
  let editedCaptions;
  try {
    rawCaptions = JSON.parse(readFileSync(rawPath, 'utf8'));
    editedCaptions = JSON.parse(readFileSync(editedPath, 'utf8'));
  } catch (e) {
    console.error(`diff_captions: parse error — ${e.message}`);
    process.exit(1);
  }

  const rawWords = flattenWords(rawCaptions);
  const editedWords = flattenWords(editedCaptions);

  if (rawWords.length === 0) {
    console.error('diff_captions: raw file has no word-level timings — cannot align.');
    process.exit(1);
  }

  const corrections = greedyAlign(rawWords, editedWords);

  const project = projectFlag || deriveProjectLabel(editedPath);
  const date = new Date().toISOString().slice(0, 10);

  if (!existsSync(LOG_PATH)) {
    writeFileSync(LOG_PATH, LOG_HEADER, 'utf8');
  }

  if (corrections.length > 0) {
    const lines =
      corrections
        .map((c) => JSON.stringify({ ...c, project, date }))
        .join('\n') + '\n';
    appendFileSync(LOG_PATH, lines, 'utf8');
  }

  console.log(`Logged ${corrections.length} corrections for ${project}`);
}

try {
  main();
} catch (e) {
  console.error(`diff_captions: ${e.message}`);
  process.exit(1);
}
