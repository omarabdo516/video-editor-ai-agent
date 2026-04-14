#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function timestampToSeconds(ts) {
  const [h, m, rest] = ts.split(':');
  const [s, ms] = rest.split(',');
  return (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
}

function parseSrt(content) {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n/);
  const segments = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;

    const timeLineIdx = lines.findIndex(l => l.includes('-->'));
    if (timeLineIdx === -1) continue;

    const [startTs, endTs] = lines[timeLineIdx].split('-->').map(s => s.trim());
    const text = lines.slice(timeLineIdx + 1).join(' ').trim();
    if (!text) continue;

    const start = timestampToSeconds(startTs);
    const end = timestampToSeconds(endTs);

    segments.push({ start, end, text, words: distributeWords(text, start, end) });
  }

  return segments;
}

function distributeWords(text, start, end) {
  const words = text.split(/\s+/).filter(Boolean);
  const totalDuration = end - start;
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  if (totalChars === 0) return [];

  const perChar = totalDuration / totalChars;
  let cursor = start;
  const result = [];

  for (const word of words) {
    const wordDuration = word.length * perChar;
    result.push({
      word,
      start: +cursor.toFixed(3),
      end: +(cursor + wordDuration).toFixed(3),
    });
    cursor += wordDuration;
  }

  return result;
}

function main() {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath) {
    console.error('Usage: node srt-parser.js <input.srt> [output.json]');
    process.exit(1);
  }

  const absInput = path.resolve(inputPath);
  if (!fs.existsSync(absInput)) {
    console.error(`File not found: ${absInput}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absInput, 'utf8');
  const segments = parseSrt(raw);

  const output = {
    source: absInput,
    segmentCount: segments.length,
    totalDuration: segments.length ? segments[segments.length - 1].end : 0,
    segments,
  };

  const outFile = outputPath
    ? path.resolve(outputPath)
    : absInput.replace(/\.srt$/i, '.captions.json');

  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Parsed ${segments.length} segments → ${outFile}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (invokedDirectly) {
  main();
}

export { parseSrt, timestampToSeconds, distributeWords };
