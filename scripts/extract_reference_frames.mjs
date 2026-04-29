#!/usr/bin/env node
// extract_reference_frames.mjs
//
// Extract frames from a reference video for design analysis.
//
// Two passes:
//   1. Uniform sampling at a fixed interval (default 0.5 fps = 1 frame / 2s)
//   2. Scene-cut detection (ffmpeg `scene` filter, default threshold 0.4)
//
// Output layout (next to the source video by convention):
//   <output-dir>/
//     frames/
//       uniform/   frame_t0000.0s.jpg, frame_t0002.0s.jpg, ...
//       scene_cuts/cut_t0003.2s.jpg, cut_t0008.7s.jpg, ...
//     scene_cuts.json   { threshold, cuts: [{time, file}] }
//
// Frames are downsized so the long edge is <= 960px (keeps each JPEG
// 60-150 KB, which is the sweet spot for feeding many frames into a
// vision-LLM context without burning tokens).
//
// Usage:
//   node scripts/extract_reference_frames.mjs <video> \
//     --output <dir> \
//     [--fps 0.5] \
//     [--scene-threshold 0.4] \
//     [--max-frames 200]

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FFMPEG = 'C:/ffmpeg/bin/ffmpeg.exe';
const FFPROBE = 'C:/ffmpeg/bin/ffprobe.exe';

function parseArgs(argv) {
  const args = { fps: 0.5, sceneThreshold: 0.4, maxFrames: 200 };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--output' || a === '-o') args.output = argv[++i];
    else if (a === '--fps') args.fps = parseFloat(argv[++i]);
    else if (a === '--scene-threshold') args.sceneThreshold = parseFloat(argv[++i]);
    else if (a === '--max-frames') args.maxFrames = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') args.help = true;
    else positional.push(a);
  }
  args.video = positional[0];
  return args;
}

function printHelp() {
  console.log(`
extract_reference_frames.mjs — pull frames from a reference video for design analysis

Usage:
  node scripts/extract_reference_frames.mjs <video> --output <dir> [options]

Options:
  --output, -o <dir>       Output directory (required)
  --fps <n>                Uniform sampling rate (default 0.5 = 1 frame / 2s)
  --scene-threshold <0-1>  Scene-cut sensitivity (default 0.4; lower = more cuts)
  --max-frames <n>         Hard cap on uniform frames (default 200; auto-throttles fps)
  --help, -h               Show this help

Output:
  <dir>/frames/uniform/     frame_tNNNN.Ns.jpg  (one per uniform tick)
  <dir>/frames/scene_cuts/  cut_tNNNN.Ns.jpg    (one per detected cut)
  <dir>/scene_cuts.json     { threshold, cuts: [{time, file}] }
`);
}

function probeDuration(videoPath) {
  const r = spawnSync(
    FFPROBE,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) throw new Error(`ffprobe failed: ${r.stderr}`);
  return parseFloat(r.stdout.trim());
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Run ffmpeg, stream stderr to caller's stderr so the user sees progress.
// Returns a Promise that resolves with the captured stderr text (we parse
// it for showinfo lines). The `tolerateNoFrames` flag treats the
// "filter produced 0 output frames" case as success rather than failure —
// useful for scene detection on videos with no detected cuts.
function runFfmpeg(args, { quiet = false, tolerateNoFrames = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (!quiet) process.stderr.write(text);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stderr);
      } else if (
        tolerateNoFrames &&
        /No filtered frames for output stream|Nothing was written into output file/i.test(stderr)
      ) {
        // Scene filter produced no frames — that's a valid result, not an error.
        resolve(stderr);
      } else {
        reject(new Error(`ffmpeg exited ${code}`));
      }
    });
    child.on('error', reject);
  });
}

// Pass 1: uniform sampling.
//
// We use ffmpeg's vframes-style numbered output (frame_%05d.jpg) and rename
// to timestamps after the fact, since putting timestamps directly in the
// filename pattern is awkward in ffmpeg.
async function extractUniformFrames(videoPath, outDir, fps) {
  ensureDir(outDir);
  const pattern = path.join(outDir, 'frame_%05d.jpg');
  console.log(`\n[uniform] extracting at ${fps} fps...`);
  // `format=yuvj420p` after scale fixes the "Non full-range YUV is non-standard"
  // mjpeg encoder error on some recordings (esp. screen captures).
  await runFfmpeg([
    '-hide_banner',
    '-loglevel', 'warning',
    '-y',
    '-i', videoPath,
    '-vf', `fps=${fps},scale='if(gt(iw,ih),min(960,iw),-2)':'if(gt(iw,ih),-2,min(960,ih))',format=yuvj420p`,
    '-q:v', '4',
    pattern,
  ], { quiet: true });

  // Rename frame_NNNNN.jpg → frame_tXXXX.Ns.jpg based on extraction index.
  const interval = 1 / fps;
  const files = readdirSync(outDir).filter((f) => /^frame_\d+\.jpg$/.test(f)).sort();
  const renamed = [];
  for (let i = 0; i < files.length; i++) {
    const t = i * interval;
    const tStr = t.toFixed(1).padStart(6, '0'); // "0002.5"
    const newName = `frame_t${tStr}s.jpg`;
    const oldPath = path.join(outDir, files[i]);
    const newPath = path.join(outDir, newName);
    renameSync(oldPath, newPath);
    renamed.push({ time: t, file: newName });
  }
  console.log(`[uniform] ${renamed.length} frames extracted`);
  return renamed;
}

// Pass 2: scene-cut detection.
//
// ffmpeg's `select='gt(scene,T)'` filter combined with `showinfo` emits
// pts_time for each surviving frame to stderr. We parse those, then rename
// the numbered output files to include the timestamp.
async function extractSceneCuts(videoPath, outDir, threshold) {
  ensureDir(outDir);
  const pattern = path.join(outDir, 'cut_%05d.jpg');
  console.log(`\n[scenes] detecting cuts (threshold=${threshold})...`);
  const stderr = await runFfmpeg([
    '-hide_banner',
    '-loglevel', 'info',
    '-y',
    '-i', videoPath,
    '-vf', `select='gt(scene,${threshold})',scale='if(gt(iw,ih),min(960,iw),-2)':'if(gt(iw,ih),-2,min(960,ih))',format=yuvj420p,showinfo`,
    '-vsync', 'vfr',
    '-q:v', '4',
    pattern,
  ], { quiet: true, tolerateNoFrames: true });

  // Parse pts_time from showinfo lines:
  //   [Parsed_showinfo_1 @ ...] n: 0 pts: 12345 pts_time:3.234 ...
  const times = [];
  const re = /pts_time:([\d.]+)/g;
  let m;
  while ((m = re.exec(stderr))) times.push(parseFloat(m[1]));

  const files = readdirSync(outDir).filter((f) => /^cut_\d+\.jpg$/.test(f)).sort();
  if (files.length !== times.length) {
    console.warn(`[scenes] warning: ${files.length} files but ${times.length} timestamps parsed; using min`);
  }
  const n = Math.min(files.length, times.length);
  const cuts = [];
  for (let i = 0; i < n; i++) {
    const t = times[i];
    const tStr = t.toFixed(1).padStart(6, '0');
    const newName = `cut_t${tStr}s.jpg`;
    renameSync(path.join(outDir, files[i]), path.join(outDir, newName));
    cuts.push({ time: t, file: newName });
  }
  // If we got more files than timestamps (shouldn't happen, but be safe), drop the tails.
  for (let i = n; i < files.length; i++) {
    try { renameSync(path.join(outDir, files[i]), path.join(outDir, files[i] + '.orphan')); } catch {}
  }
  console.log(`[scenes] ${cuts.length} cuts extracted`);
  return cuts;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.video || !args.output) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  if (!existsSync(args.video)) {
    console.error(`error: video not found: ${args.video}`);
    process.exit(1);
  }

  const duration = probeDuration(args.video);
  console.log(`video: ${args.video}`);
  console.log(`duration: ${duration.toFixed(1)}s`);

  // Auto-throttle fps if it would produce more than maxFrames uniform frames.
  let effectiveFps = args.fps;
  const projected = duration * effectiveFps;
  if (projected > args.maxFrames) {
    effectiveFps = args.maxFrames / duration;
    console.log(
      `[uniform] requested ${args.fps} fps would produce ${Math.round(projected)} frames; ` +
      `throttling to ${effectiveFps.toFixed(3)} fps to stay under --max-frames=${args.maxFrames}`
    );
  }

  ensureDir(args.output);
  const uniformDir = path.join(args.output, 'frames', 'uniform');
  const cutsDir = path.join(args.output, 'frames', 'scene_cuts');

  const uniformFrames = await extractUniformFrames(args.video, uniformDir, effectiveFps);
  const sceneCuts = await extractSceneCuts(args.video, cutsDir, args.sceneThreshold);

  const sceneCutsJson = {
    source: args.video,
    duration_sec: duration,
    threshold: args.sceneThreshold,
    cut_count: sceneCuts.length,
    cuts: sceneCuts.map((c) => ({ time: c.time, file: `frames/scene_cuts/${c.file}` })),
    uniform_fps: effectiveFps,
    uniform_frame_count: uniformFrames.length,
    uniform_frames: uniformFrames.map((f) => ({ time: f.time, file: `frames/uniform/${f.file}` })),
  };
  writeFileSync(
    path.join(args.output, 'scene_cuts.json'),
    JSON.stringify(sceneCutsJson, null, 2),
    'utf8'
  );
  console.log(`\n✓ wrote ${path.join(args.output, 'scene_cuts.json')}`);
  console.log(`  uniform: ${uniformFrames.length} frames @ ${effectiveFps.toFixed(3)} fps`);
  console.log(`  scenes:  ${sceneCuts.length} cuts @ threshold ${args.sceneThreshold}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
