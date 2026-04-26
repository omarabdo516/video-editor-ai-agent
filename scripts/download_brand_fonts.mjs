#!/usr/bin/env node
/**
 * Download Alexandria + IBM Plex Sans Arabic woff2 files from Google Fonts
 * into public/fonts/. Mirrors the previous Cairo + Tajawal layout so that
 * src/utils/fonts.ts can swap the references in place.
 *
 * Output naming:
 *   Alexandria-arabic.woff2          (variable, Arabic unicode range)
 *   Alexandria-latin.woff2           (variable, Latin unicode range)
 *   IBMPlexSansArabic-Regular-arabic.woff2  (weight 400)
 *   IBMPlexSansArabic-Regular-latin.woff2
 *   IBMPlexSansArabic-Medium-arabic.woff2   (weight 500)
 *   IBMPlexSansArabic-Medium-latin.woff2
 *   IBMPlexSansArabic-Bold-arabic.woff2     (weight 700 — IBM Plex Sans Arabic max)
 *   IBMPlexSansArabic-Bold-latin.woff2
 *
 * Note: IBM Plex Sans Arabic maxes out at Bold (700). The previous Tajawal
 * setup used ExtraBold (800), so the migration drops one weight tier.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const fontsDir = join(repoRoot, 'public', 'fonts');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const WEIGHT_NAME = {
  400: 'Regular',
  500: 'Medium',
  700: 'Bold',
};

const targets = [
  {
    family: 'Alexandria',
    cssUrl:
      'https://fonts.googleapis.com/css2?family=Alexandria:wght@100..900&display=swap',
    fileBase: 'Alexandria',
    variable: true,
  },
  {
    family: 'IBM Plex Sans Arabic',
    cssUrl:
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&display=swap',
    fileBase: 'IBMPlexSansArabic',
    variable: false,
    weights: [400, 500, 700],
  },
];

async function fetchCss(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    throw new Error(`CSS fetch failed: ${url} → ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

/**
 * Parse @font-face blocks. For each block extract:
 *   - font-weight (single value or "X Y" range for variable)
 *   - unicode-range
 *   - src url(...)woff2
 * Classify range as 'arabic' or 'latin' by presence of U+06xx in range.
 */
function parseFontFaces(css) {
  const blocks = [];
  const blockRe = /@font-face\s*\{([^}]*)\}/g;
  let match;
  while ((match = blockRe.exec(css)) !== null) {
    const body = match[1];
    const weightMatch = body.match(/font-weight:\s*([^;]+);/);
    const urlMatch = body.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/);
    const rangeMatch = body.match(/unicode-range:\s*([^;]+);/);
    if (!urlMatch || !rangeMatch) continue;
    const weight = weightMatch ? weightMatch[1].trim() : '400';
    const range = rangeMatch[1].trim();
    const url = urlMatch[1].trim();
    const isArabic = /U\+06|U\+075|U\+087|U\+089|U\+08[E-F]|U\+FB5|U\+FE7|U\+FE8/i.test(
      range
    );
    blocks.push({
      weight,
      range,
      url,
      slot: isArabic ? 'arabic' : 'latin',
    });
  }
  return blocks;
}

async function downloadBinary(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`woff2 fetch failed: ${url} → ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

async function processTarget(target) {
  console.log(`\n=== ${target.family} ===`);
  const css = await fetchCss(target.cssUrl);
  const blocks = parseFontFaces(css);
  if (blocks.length === 0) {
    throw new Error(`No @font-face blocks parsed for ${target.family}`);
  }
  console.log(`  Parsed ${blocks.length} @font-face blocks`);

  // For variable fonts, take the first arabic + first latin and write 2 files.
  // For static fonts, group by weight.
  if (target.variable) {
    const arabic = blocks.find((b) => b.slot === 'arabic');
    const latin = blocks.find((b) => b.slot === 'latin');
    if (!arabic || !latin) {
      throw new Error(`Missing arabic/latin slot for ${target.family}`);
    }
    for (const [slot, block] of [
      ['arabic', arabic],
      ['latin', latin],
    ]) {
      const fileName = `${target.fileBase}-${slot}.woff2`;
      const outPath = join(fontsDir, fileName);
      const buf = await downloadBinary(block.url);
      await writeFile(outPath, buf);
      console.log(`  ✓ ${fileName} (${(buf.length / 1024).toFixed(1)} KB)`);
    }
    return;
  }

  // Static: dedupe by (weight, slot)
  const seen = new Set();
  for (const block of blocks) {
    const w = parseInt(block.weight, 10);
    if (!target.weights.includes(w)) continue; // ignore weights we didn't ask for
    const key = `${w}-${block.slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const weightLabel = WEIGHT_NAME[w] || `W${w}`;
    const fileName = `${target.fileBase}-${weightLabel}-${block.slot}.woff2`;
    const outPath = join(fontsDir, fileName);
    const buf = await downloadBinary(block.url);
    await writeFile(outPath, buf);
    console.log(`  ✓ ${fileName} (${(buf.length / 1024).toFixed(1)} KB)`);
  }

  const expected = target.weights.length * 2;
  if (seen.size !== expected) {
    console.warn(
      `  ⚠ Got ${seen.size} files, expected ${expected} for ${target.family}`
    );
  }
}

async function main() {
  await mkdir(fontsDir, { recursive: true });
  console.log(`Output dir: ${fontsDir}`);
  for (const target of targets) {
    await processTarget(target);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
});
