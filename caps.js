#!/usr/bin/env node
/**
 * caps.js — Caption editing helper.
 *
 * Exports Whisper captions.json to a standard .srt file that can be edited in
 * any subtitle editor (Subtitle Edit, Aegisub, VS Code), and re-imports the
 * edited .srt back to captions.json — automatically redistributing word-level
 * timings proportionally to each word's character count.
 *
 * Usage:
 *   node caps.js export <captions.json> [output.srt]
 *   node caps.js import <edited.srt>     [captions.json]
 *
 * Typical workflow:
 *   1. node caps.js export video.mp4.captions.json
 *   2. Edit video.mp4.captions.srt in any subtitle editor
 *   3. node caps.js import video.mp4.captions.srt
 *   4. node rs-reels.mjs make ... --skip-audio --skip-transcribe
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseSrt } from './srt-parser.js';

// ─── JSON → SRT ────────────────────────────────────────────────────────────
function secondsToTimestamp(sec) {
  if (sec < 0) sec = 0;
  const ms = Math.round((sec % 1) * 1000);
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function jsonToSrt(captions) {
  const lines = [];
  captions.segments.forEach((seg, i) => {
    lines.push(String(i + 1));
    lines.push(`${secondsToTimestamp(seg.start)} --> ${secondsToTimestamp(seg.end)}`);
    lines.push(seg.text.trim());
    lines.push('');
  });
  return lines.join('\n');
}

function exportToSrt(jsonPath, srtPath) {
  const abs = path.resolve(jsonPath);
  if (!fs.existsSync(abs)) {
    console.error(`Not found: ${abs}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const out = srtPath ? path.resolve(srtPath) : abs.replace(/\.json$/i, '.srt');
  fs.writeFileSync(out, jsonToSrt(data), 'utf8');
  console.log(`Exported ${data.segments.length} segments → ${out}`);
  console.log(`\n📝 Edit this file in VS Code, Subtitle Edit, Aegisub, or any editor.`);
  console.log(`   When done, run:  node caps.js import "${out}"`);
}

// ─── SRT → JSON ────────────────────────────────────────────────────────────
function importFromSrt(srtPath, jsonPath) {
  const abs = path.resolve(srtPath);
  if (!fs.existsSync(abs)) {
    console.error(`Not found: ${abs}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const segments = parseSrt(raw);

  if (segments.length === 0) {
    console.error('No segments parsed. Check the SRT format.');
    process.exit(1);
  }

  // Default target: overwrite the .captions.json that matches this .srt name
  const defaultTarget = abs.replace(/\.srt$/i, '.json');
  const target = jsonPath ? path.resolve(jsonPath) : defaultTarget;

  // Preserve original metadata (language, etc.) if the JSON already exists
  let meta = {};
  if (fs.existsSync(target)) {
    try {
      const existing = JSON.parse(fs.readFileSync(target, 'utf8'));
      meta = {
        language: existing.language,
      };
    } catch {}
  }

  const output = {
    language: meta.language || 'ar',
    totalDuration: segments[segments.length - 1].end,
    segmentCount: segments.length,
    segments,
  };

  fs.writeFileSync(target, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Imported ${segments.length} segments → ${target}`);
  console.log(`\n▶️  Re-render with:`);
  console.log(`   node rs-reels.mjs make <video> --skip-audio --skip-transcribe ...`);
}

// ─── main ──────────────────────────────────────────────────────────────────
const [, , cmd, input, output] = process.argv;

if (!cmd || !input) {
  console.log(`Usage:
  node caps.js export <captions.json> [output.srt]
  node caps.js import <edited.srt>    [captions.json]

Workflow:
  1. node caps.js export video.mp4.captions.json
  2. Open the generated .srt in your editor of choice
  3. Fix typos / timing / split / merge lines
  4. node caps.js import video.mp4.captions.srt
  5. node rs-reels.mjs make ... --skip-audio --skip-transcribe`);
  process.exit(1);
}

if (cmd === 'export') exportToSrt(input, output);
else if (cmd === 'import') importFromSrt(input, output);
else {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
