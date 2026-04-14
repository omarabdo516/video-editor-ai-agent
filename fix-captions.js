#!/usr/bin/env node
/**
 * fix-captions.js — Apply Arabic spelling corrections to Whisper captions.json.
 *
 * Whisper tends to transcribe Egyptian Arabic phonetically, resulting in errors
 * like "مسلا" instead of "مثلاً" (because ث is pronounced like س in Egyptian).
 * This script applies a curated substitution map to fix common errors while
 * preserving word-level timings.
 *
 * Usage:
 *   node fix-captions.js <captions.json> [--output fixed.json]
 */

import fs from 'node:fs';
import path from 'node:path';

// Substitution map: { wrong: correct }
// Keep keys sorted by length descending to match longer phrases first.
const SUBSTITUTIONS = [
  // ض ↔ د (Egyptian pronunciation of ض)
  ['درائب', 'ضرائب'],
  ['الدرائب', 'الضرائب'],
  // ث ↔ س (Egyptian pronunciation of ث)
  ['مسلا', 'مثلاً'],
  ['مسلاً', 'مثلاً'],
  // ؤ errors
  ['ورقصها حسابات', 'ورؤسا حسابات'],
  ['ورقصها', 'ورؤسا'],
  // Specific dialect transliteration fixes
  ['متسانطر', 'متسنطر'],
  ['الزمل اللي', 'الزملا اللي'],
  ['فريشة', 'فريش'],
  ['ارس تخدمك', 'ريس يخدمك'],
  ['بتفوله', 'بتأوله'],
  // Common tweaks
  ['تلات ورش', 'تلات ورش'],
  ['الاكونتنج', 'الأكونتنج'],
  ['البوزيشن', 'البوزيشن'],
  ['البوزيشنز', 'البوزيشنز'],
  // Punctuation cleanup
  ['  ', ' '],
];

function applySubstitutions(text) {
  let result = text;
  for (const [wrong, correct] of SUBSTITUTIONS) {
    // Use split/join for literal replacement (no regex special chars to escape)
    if (result.includes(wrong)) {
      result = result.split(wrong).join(correct);
    }
  }
  return result.trim();
}

function fixSegment(seg) {
  const fixedText = applySubstitutions(seg.text);

  // Re-derive words from the fixed text, mapping timings proportionally
  // from original words (since substitutions can change word count slightly)
  const newWords = fixedText.split(/\s+/).filter(Boolean);
  const origWords = seg.words || [];

  let words;
  if (newWords.length === origWords.length) {
    // Same count — just replace the word strings
    words = origWords.map((w, i) => ({ ...w, word: newWords[i] }));
  } else if (origWords.length > 0) {
    // Different count — distribute proportionally
    const totalDuration = seg.end - seg.start;
    const totalChars = newWords.reduce((sum, w) => sum + w.length, 0) || 1;
    const perChar = totalDuration / totalChars;
    let cursor = seg.start;
    words = newWords.map(w => {
      const wordDur = w.length * perChar;
      const entry = {
        word: w,
        start: +cursor.toFixed(3),
        end: +(cursor + wordDur).toFixed(3),
      };
      cursor += wordDur;
      return entry;
    });
  } else {
    words = [];
  }

  return { ...seg, text: fixedText, words };
}

function main() {
  const [inputPath, ...rest] = process.argv.slice(2);
  if (!inputPath) {
    console.error('Usage: node fix-captions.js <captions.json> [--output fixed.json]');
    process.exit(1);
  }

  const outIdx = rest.indexOf('--output');
  const outputPath = outIdx > -1 ? rest[outIdx + 1] : inputPath;

  const absIn = path.resolve(inputPath);
  const data = JSON.parse(fs.readFileSync(absIn, 'utf8'));

  let totalFixes = 0;
  const fixedSegments = data.segments.map(seg => {
    const before = seg.text;
    const fixed = fixSegment(seg);
    if (fixed.text !== before) {
      totalFixes++;
      console.log(`  [${seg.start.toFixed(1)}] ${before}`);
      console.log(`  [${seg.start.toFixed(1)}] → ${fixed.text}\n`);
    }
    return fixed;
  });

  const output = { ...data, segments: fixedSegments };
  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(output, null, 2), 'utf8');

  console.log(`\nFixed ${totalFixes}/${data.segments.length} segments`);
  console.log(`Wrote: ${outputPath}`);
}

main();
