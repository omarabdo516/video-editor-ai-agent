#!/usr/bin/env node
// analyze_reference.mjs
//
// Orchestrator for reference-video analysis. Given a video path, it:
//   1. Picks an output folder (default: references/<basename>/_analysis/)
//   2. Runs extract_reference_frames.mjs (uniform + scene-cuts)
//   3. Runs scripts/video_metadata.py for ffprobe metadata
//   4. Optionally extracts a 16k mono WAV + runs scripts/audio_energy.py
//      to flag emphasis moments worth studying (timestamps where the
//      creator is hyped or pausing for effect)
//   5. Writes analysis.template.md — a structured stub for Claude to fill
//      after viewing the frames
//
// All steps are idempotent: re-running on the same video skips work that's
// already done. Pass --force to regenerate everything.
//
// Usage:
//   node scripts/analyze_reference.mjs <video> [--output <dir>] [--force] [--no-audio]

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const FFMPEG = 'C:/ffmpeg/bin/ffmpeg.exe';
const PY = process.env.WHISPER_PY
  || `${(process.env.USERPROFILE || '').replace(/\\/g, '/')}/Documents/Claude/_tools/whisper-env/.venv/Scripts/python.exe`;

function parseArgs(argv) {
  const args = { force: false, audio: true };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--output' || a === '-o') args.output = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '--no-audio') args.audio = false;
    else if (a === '--fps') args.fps = argv[++i];
    else if (a === '--scene-threshold') args.sceneThreshold = argv[++i];
    else if (a === '--max-frames') args.maxFrames = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else positional.push(a);
  }
  args.video = positional[0];
  return args;
}

function printHelp() {
  console.log(`
analyze_reference.mjs — extract everything Claude needs to study a reference video

Usage:
  node scripts/analyze_reference.mjs <video> [options]

Options:
  --output, -o <dir>       Output dir (default: references/<basename>/_analysis/)
  --force                  Re-run even if outputs already exist
  --no-audio               Skip audio-energy analysis
  --fps <n>                Pass-through to extract_reference_frames (default 0.5)
  --scene-threshold <0-1>  Pass-through to extract_reference_frames (default 0.4)
  --max-frames <n>         Pass-through to extract_reference_frames (default 200)
  --help, -h               Show help

Output:
  <output>/metadata.json         ffprobe data (duration, fps, codecs, ...)
  <output>/frames/uniform/       JPEG every 1/fps seconds
  <output>/frames/scene_cuts/    JPEG at each detected scene change
  <output>/scene_cuts.json       cut timestamps + frame index
  <output>/audio_energy.json     emphasis moments (high-energy / dramatic-pause)
  <output>/analysis.template.md  structured stub for Claude to fill

After running this, ask Claude:
  "حلّل الـ reference بتاع <output>/"
`);
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function runChildSync(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} exited with ${r.status}`);
}

function runChildAsync(cmd, args) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    child.on('error', reject);
  });
}

function defaultOutputDir(videoPath) {
  // Co-locate analysis with the video. If the video already lives under
  // references/<name>/, output goes to references/<name>/_analysis/.
  // Otherwise we use references/<basename>/_analysis/ at repo root.
  const base = path.basename(videoPath, path.extname(videoPath));
  const dir = path.dirname(path.resolve(videoPath));
  if (path.basename(path.dirname(dir)) === 'references') {
    // video is at references/<name>/source.ext
    return path.join(dir, '_analysis');
  }
  return path.join(REPO_ROOT, 'references', base, '_analysis');
}

function extractAudioWav(videoPath, wavPath) {
  if (existsSync(wavPath)) {
    console.log(`  audio already extracted: ${wavPath}`);
    return;
  }
  console.log(`\n[audio] extracting 16k mono WAV...`);
  runChildSync(FFMPEG, [
    '-hide_banner',
    '-loglevel', 'warning',
    '-y',
    '-i', videoPath,
    '-ac', '1',
    '-ar', '16000',
    '-vn',
    wavPath,
  ]);
}

function writeTemplate(outputDir, args, sceneCutCount, uniformCount) {
  const tplPath = path.join(outputDir, 'analysis.template.md');
  if (existsSync(tplPath) && !args.force) {
    console.log(`  template already exists (use --force to overwrite): ${tplPath}`);
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  const md = `# Reference Analysis — ${path.basename(args.video)}

> **Source:** \`${args.video}\`
> **Analyzed:** ${date}
> **Status:** TEMPLATE — Claude fills this in after viewing frames

---

## 1. At a glance

- **Duration:** _(read from metadata.json)_
- **Aspect ratio:** _(9:16 / 16:9 / 1:1 / other)_
- **Format type:** _(reel / talking-head / scrollytelling / explainer / b-roll-heavy / other)_
- **Vibe in one sentence:** _(e.g. "high-energy financial explainer with bold pop-up captions and rhythmic zoom punches")_
- **Frames sampled:** ${uniformCount} uniform + ${sceneCutCount} scene cuts

---

## 2. Caption / typography system

- **Style:** _(hormozi-word-pop / karaoke / typewriter / classic-block / mixed / none)_
- **Position:** _(top / center / lower-third / floating / changes per moment)_
- **Font character:** _(geometric / humanist / display / handwritten / mixed)_
- **Active-word treatment:** _(color shift / scale boost / glow / box / underline)_
- **Color palette in captions:** _(list 2-3 hex approximations)_
- **What's worth stealing for RS:** _(specific tactic, with timestamp reference)_

---

## 3. Scene composition

| Scene type seen | Timestamp | What's on screen | Worth stealing? |
|---|---|---|---|
| _(e.g. counter)_ | _(00:08)_ | _(massive number + label)_ | _(yes/no/why)_ |

---

## 4. Color & atmosphere

- **Dominant palette:** _(3-5 colors with rough hex)_
- **Background treatment:** _(flat / gradient / motion-bg / textured / footage)_
- **Contrast strategy:** _(high / muted / inverted-on-emphasis)_

---

## 5. Motion & pacing

- **Avg time between visual events:** _(seconds — compare to RS target ~4s)_
- **Scene-cut rhythm:** _(steady / accelerating / chunked-with-pauses)_
- **Camera/zoom dynamics:** _(static / dolly-in / crash-zoom / handheld-jitter)_
- **Transition vocabulary:** _(cut / fade / slide / scale / mixed)_

---

## 6. Retention tricks observed

- _(e.g. "every ~3s a new visual element pops in even if speech continues")_
- _(e.g. "uses a stamp overlay to reset attention at 0:12")_

---

## 7. Brand fit verdict for RS

- **Direct steal candidates:** _(things we should add to BRAND.md / tokens.ts)_
- **Adapt-with-changes:** _(things to take but recolor / restyle)_
- **Skip / off-brand:** _(things that look great but don't fit RS)_

---

## 8. Promote to library?

- [ ] yes — add to \`feedback/reference_library.md\` under section: _____
- [ ] keep as one-off study, no promotion needed

---

## Frame index

The two folders below are what you (Claude) should read with the Read tool to do the analysis above.

- \`frames/uniform/\` — ${uniformCount} JPEGs sampled at fixed interval
- \`frames/scene_cuts/\` — ${sceneCutCount} JPEGs at detected scene boundaries
- \`scene_cuts.json\` — timestamps + filenames in machine-readable form
- \`metadata.json\` — ffprobe data
- \`audio_energy.json\` — emphasis moments (where the creator is hyped or pausing)

Read 5-10 frames at a time and synthesize. You don't need to comment on every frame.
`;
  writeFileSync(tplPath, md, 'utf8');
  console.log(`  ✓ wrote ${tplPath}`);
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.video) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  if (!existsSync(args.video)) {
    console.error(`error: video not found: ${args.video}`);
    process.exit(1);
  }

  const outputDir = path.resolve(args.output || defaultOutputDir(args.video));
  ensureDir(outputDir);
  console.log(`[analyze] video:  ${args.video}`);
  console.log(`[analyze] output: ${outputDir}`);

  // 1. ffprobe metadata.
  const metaPath = path.join(outputDir, 'metadata.json');
  if (!existsSync(metaPath) || args.force) {
    runChildSync(PY, [
      path.join(REPO_ROOT, 'scripts', 'video_metadata.py'),
      args.video,
      '--output', metaPath,
    ]);
  } else {
    console.log(`  metadata already exists: ${metaPath}`);
  }

  // 2. Frame extraction.
  const sceneCutsJsonPath = path.join(outputDir, 'scene_cuts.json');
  if (!existsSync(sceneCutsJsonPath) || args.force) {
    const frameArgs = [
      path.join(REPO_ROOT, 'scripts', 'extract_reference_frames.mjs'),
      args.video,
      '--output', outputDir,
    ];
    if (args.fps) frameArgs.push('--fps', args.fps);
    if (args.sceneThreshold) frameArgs.push('--scene-threshold', args.sceneThreshold);
    if (args.maxFrames) frameArgs.push('--max-frames', args.maxFrames);
    await runChildAsync('node', frameArgs);
  } else {
    console.log(`  frames already extracted: ${sceneCutsJsonPath}`);
  }

  // 3. Audio energy (optional).
  if (args.audio) {
    const wavPath = path.join(outputDir, 'audio.16k.wav');
    const energyPath = path.join(outputDir, 'audio_energy.json');
    if (!existsSync(energyPath) || args.force) {
      extractAudioWav(args.video, wavPath);
      runChildSync(PY, [
        path.join(REPO_ROOT, 'scripts', 'audio_energy.py'),
        wavPath,
        '--output', energyPath,
      ]);
    } else {
      console.log(`  audio_energy already exists: ${energyPath}`);
    }
  }

  // 4. Analysis template.
  const uniformCount = countFiles(path.join(outputDir, 'frames', 'uniform'));
  const sceneCutCount = countFiles(path.join(outputDir, 'frames', 'scene_cuts'));
  writeTemplate(outputDir, args, sceneCutCount, uniformCount);

  console.log(`\n✓ reference analysis ready`);
  console.log(`  next step: ask Claude → "حلّل الـ reference بتاع ${path.relative(REPO_ROOT, outputDir)}/"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
