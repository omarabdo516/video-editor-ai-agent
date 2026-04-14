#!/usr/bin/env node
/**
 * rs-reels.mjs — End-to-end CLI for the RS Hero lecturer Reels pipeline.
 *
 * Usage:
 *   node rs-reels.mjs make <video> --lecturer "Name" --workshop "Title"
 *     [--output reel.mp4]
 *     [--skip-transcribe]  (reuse existing captions.json)
 *     [--skip-audio]       (reuse existing 16k.wav)
 *     [--dry]              (run pipeline but stop before render)
 *     [--preview seconds]  (render only the first N seconds)
 *
 * Steps:
 *   1. Preprocess audio with FFmpeg (loudnorm, 16kHz mono WAV)
 *   2. Transcribe with Whisper (Python, faster-whisper on GPU)
 *   3. Fix Egyptian Arabic spelling errors via fix-captions.js
 *   4. Render the composition with Remotion
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync, mkdirSync, writeFileSync, readFileSync, createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── arg parsing ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args.flags[key] = true;
      } else {
        args.flags[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function abs(p) {
  return path.resolve(p);
}

function fileExists(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} (exit ${result.status})`);
  }
}

function runAsync(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    child.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Command failed: ${cmd} (exit ${code})`));
      else resolve();
    });
    child.on('error', reject);
  });
}

// ─── pipeline steps ────────────────────────────────────────────────────────
const WHISPER_VENV_PYTHON = 'C:/Users/PUZZLE/Documents/Claude/_tools/whisper-env/.venv/Scripts/python.exe';

function pythonScript(scriptName) {
  return path.join(__dirname, 'scripts', scriptName);
}

function runPython(scriptName, args) {
  const scriptPath = pythonScript(scriptName);
  if (!fileExists(scriptPath)) {
    throw new Error(`Python script not found: ${scriptPath}`);
  }
  if (!fileExists(WHISPER_VENV_PYTHON)) {
    throw new Error(`Python venv not found: ${WHISPER_VENV_PYTHON}`);
  }
  run(WHISPER_VENV_PYTHON, [scriptPath, ...args], {
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
}

function preprocessAudio(videoPath) {
  const wavPath = videoPath.replace(/\.[^.]+$/, '') + '.16k.wav';
  if (fileExists(wavPath)) {
    console.log(`✓ audio already preprocessed: ${wavPath}`);
    return wavPath;
  }
  run('node', [path.join(__dirname, 'preprocess-audio.js'), videoPath]);
  return wavPath;
}

function extractMetadata(videoPath) {
  const out = videoPath + '.metadata.json';
  if (fileExists(out)) {
    console.log(`✓ metadata already exists: ${out}`);
    return out;
  }
  runPython('video_metadata.py', [videoPath]);
  return out;
}

function detectFaces(videoPath) {
  const out = videoPath + '.face_map.json';
  if (fileExists(out)) {
    console.log(`✓ face_map already exists: ${out}`);
    return out;
  }
  runPython('face_detect.py', [videoPath]);
  return out;
}

function analyzeAudioEnergy(wavPath) {
  const out = wavPath + '.energy.json';
  if (fileExists(out)) {
    console.log(`✓ audio energy already exists: ${out}`);
    return out;
  }
  runPython('audio_energy.py', [wavPath]);
  return out;
}

function prepareVideo(videoPath) {
  const scaledPath = videoPath.replace(/\.[^.]+$/, '') + '.1080x1920.mp4';
  if (fileExists(scaledPath)) {
    console.log(`✓ pre-scaled video already exists: ${scaledPath}`);
    return scaledPath;
  }
  console.log(`\n> ffmpeg: cropping → 1080x1920 (center, cover)`);
  const ffArgs = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-y',
    '-i', videoPath,
    '-vf',
    // scale so the short side matches 1080, then center-crop to 1080x1920
    "scale='if(gt(a,9/16),-2,1080)':'if(gt(a,9/16),1920,-2)',crop=1080:1920",
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    scaledPath,
  ];
  run('C:/ffmpeg/bin/ffmpeg.exe', ffArgs);
  return scaledPath;
}

function transcribe(wavPath, captionsOut) {
  if (fileExists(captionsOut)) {
    console.log(`✓ captions already exist: ${captionsOut}`);
    return captionsOut;
  }
  run('node', [
    path.join(__dirname, 'transcribe.js'),
    wavPath,
    '--output',
    captionsOut,
    '--model',
    'large-v3',
    '--no-prompt',
  ]);
  return captionsOut;
}

function fixCaptions(captionsPath) {
  run('node', [path.join(__dirname, 'fix-captions.js'), captionsPath]);
  return captionsPath;
}

// Spawn a tiny HTTP server to serve files over localhost — Remotion's
// OffthreadVideo cannot load file:// URLs during headless render, and the
// browser-based subtitle editor needs CORS-friendly URLs to fetch the video
// + captions.
//
// `routes` maps URL paths → absolute file paths, e.g.
//   { '/video.mp4': 'D:/.../scaled.mp4', '/captions.json': 'D:/.../caps.json' }
//
// For backwards compatibility a string `videoPath` is treated as
// { '/video.mp4': videoPath }.
function startFileServer(routes, fixedPort = 0) {
  if (typeof routes === 'string') {
    routes = { '/video.mp4': routes };
  }

  // Pre-stat all files so 404s are caught at startup
  const fileMeta = {};
  for (const [route, filePath] of Object.entries(routes)) {
    fileMeta[route] = { path: filePath, stat: statSync(filePath) };
  }

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    const meta = fileMeta[req.url];
    if (!meta) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not found: ${req.url}\nAvailable: ${Object.keys(fileMeta).join(', ')}`);
      return;
    }

    const total = meta.stat.size;
    const contentType = guessMime(meta.path);

    const range = req.headers.range;
    if (range && contentType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      createReadStream(meta.path, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      createReadStream(meta.path).pipe(res);
    }
  });

  return new Promise((resolve) => {
    server.listen(fixedPort, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`✓ file server on http://127.0.0.1:${port}`);
      for (const route of Object.keys(fileMeta)) {
        console.log(`    ${route}  →  ${path.basename(fileMeta[route].path)}`);
      }
      resolve({
        server,
        port,
        url: `http://127.0.0.1:${port}/video.mp4`, // legacy field used by render
      });
    });
  });
}

// Backwards-compatible alias for legacy call sites
const startVideoServer = startFileServer;

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.mov': return 'video/quicktime';
    case '.mkv': return 'video/x-matroska';
    case '.json': return 'application/json; charset=utf-8';
    case '.srt': return 'text/plain; charset=utf-8';
    case '.wav': return 'audio/wav';
    default: return 'application/octet-stream';
  }
}

// Look for a zoom_plan.json next to the source video. Falls back to null.
function loadZoomPlan(sourceVideoPath, previewSeconds) {
  const candidates = [
    sourceVideoPath + '.zoom_plan.json',
    sourceVideoPath.replace(/\.[^.]+$/, '') + '.zoom_plan.json',
  ];
  for (const candidate of candidates) {
    if (fileExists(candidate)) {
      try {
        const plan = JSON.parse(readFileSync(candidate, 'utf8'));
        if (previewSeconds) {
          const cutoff = Number(previewSeconds);
          plan.moments = (plan.moments || []).filter((m) => m.startSec < cutoff);
        }
        console.log(`✓ zoom plan loaded: ${candidate}  (${plan.moments?.length || 0} moments)`);
        return plan;
      } catch (e) {
        console.warn(`⚠ failed to parse zoom plan ${candidate}: ${e.message}`);
      }
    }
  }
  return null;
}

// Look for a Phase 6 animation_plan.json under src/data/<basename>/. This
// supersedes loadZoomPlan when present — the smart_zoom_plan inside it is
// used as the new zoom data, and Reel.tsx also reads scenes + overlays.
function loadAnimationPlan(sourceVideoPath, previewSeconds) {
  const baseName = path.basename(sourceVideoPath, path.extname(sourceVideoPath));
  const planPath = path.join(__dirname, 'src', 'data', baseName, 'animation_plan.json');

  if (!fileExists(planPath)) return null;

  try {
    const plan = JSON.parse(readFileSync(planPath, 'utf8'));
    if (previewSeconds) {
      const cutoff = Number(previewSeconds);
      if (plan.smart_zoom_plan?.moments) {
        plan.smart_zoom_plan.moments = plan.smart_zoom_plan.moments.filter(
          (m) => m.startSec < cutoff,
        );
      }
      if (plan.scenes) {
        plan.scenes = plan.scenes.filter((s) => s.start_sec < cutoff);
      }
      if (plan.overlays) {
        plan.overlays = plan.overlays.filter((o) => o.start_sec < cutoff);
      }
    }
    const scenes = plan.scenes?.length || 0;
    const overlays = plan.overlays?.length || 0;
    const zooms = plan.smart_zoom_plan?.moments?.length || 0;
    console.log(
      `✓ animation plan loaded: ${planPath}  (${scenes} scenes, ${overlays} overlays, ${zooms} zooms)`,
    );
    return plan;
  } catch (e) {
    console.warn(`⚠ failed to parse animation plan ${planPath}: ${e.message}`);
    return null;
  }
}

async function renderRemotion({ videoPath, captionsPath, lecturer, workshop, output, previewSeconds, sourceVideoPath }) {
  // Build props file
  const propsDir = path.join(__dirname, '.props');
  if (!existsSync(propsDir)) mkdirSync(propsDir, { recursive: true });
  const propsFile = path.join(propsDir, 'reel-props.json');

  const captions = JSON.parse(readFileSync(captionsPath, 'utf8'));

  // If a preview length is set, truncate captions to match
  let usedCaptions = captions;
  if (previewSeconds) {
    const cutoff = Number(previewSeconds);
    const segs = captions.segments.filter((s) => s.start < cutoff);
    usedCaptions = {
      ...captions,
      segments: segs,
      segmentCount: segs.length,
      totalDuration: Math.min(captions.totalDuration, cutoff),
    };
  }

  // Phase 6 animation plan supersedes the legacy zoom_plan when present
  const animationPlan = loadAnimationPlan(sourceVideoPath || videoPath, previewSeconds);
  const zoomPlan = animationPlan?.smart_zoom_plan
    ? null // smart_zoom_plan is read from animationPlan inside Reel.tsx
    : loadZoomPlan(sourceVideoPath || videoPath, previewSeconds);

  // Spin up local video server
  const { server, url: videoUrl } = await startVideoServer(videoPath);

  const props = {
    videoSrc: videoUrl,
    captions: usedCaptions,
    lecturer,
    workshop,
    zoomPlan,
    animationPlan,
  };
  writeFileSync(propsFile, JSON.stringify(props), 'utf8');
  console.log(`✓ props written: ${propsFile}`);

  try {
    const remotionCli = path.join(__dirname, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
    const renderArgs = [
      remotionCli,
      'render',
      'Reel',
      output,
      `--props=${propsFile}`,
      '--concurrency=14',
      '--timeout=120000',
      '--hardware-acceleration=if-possible',
      '--log=info',
    ];
    await runAsync('node', renderArgs, { cwd: __dirname });
  } finally {
    server.close();
  }
}

// ─── studio mode ───────────────────────────────────────────────────────────
async function runStudio(videoPath, { lecturer, workshop, skipAudio, skipTranscribe, previewSeconds }) {
  // Prep audio + captions (reuses the same pipeline as `make`)
  let wavPath;
  if (!skipAudio) wavPath = preprocessAudio(videoPath);
  else wavPath = videoPath.replace(/\.[^.]+$/, '') + '.16k.wav';

  const captionsOut = videoPath + '.captions.json';
  if (!skipTranscribe) {
    transcribe(wavPath, captionsOut);
    fixCaptions(captionsOut);
  }

  const scaledVideoPath = prepareVideo(videoPath);

  // Fixed port so Studio previews don't break on hot-reload
  const VIDEO_PORT = 7777;
  const { server, url: videoUrl } = await startVideoServer(scaledVideoPath, VIDEO_PORT);

  // Load captions (optionally truncated for a preview window)
  const captions = JSON.parse(readFileSync(captionsOut, 'utf8'));
  let usedCaptions = captions;
  if (previewSeconds) {
    const cutoff = Number(previewSeconds);
    const segs = captions.segments.filter((s) => s.start < cutoff);
    usedCaptions = {
      ...captions,
      segments: segs,
      segmentCount: segs.length,
      totalDuration: Math.min(captions.totalDuration, cutoff),
    };
  }

  const animationPlan = loadAnimationPlan(videoPath, previewSeconds);
  const zoomPlan = animationPlan?.smart_zoom_plan
    ? null
    : loadZoomPlan(videoPath, previewSeconds);

  // Write preview-props.json → Root.tsx imports it as defaultProps
  const previewPropsPath = path.join(__dirname, 'src', 'preview-props.json');
  const props = {
    videoSrc: videoUrl,
    captions: usedCaptions,
    lecturer,
    workshop,
    zoomPlan,
    animationPlan,
  };
  writeFileSync(previewPropsPath, JSON.stringify(props, null, 2), 'utf8');
  console.log(`✓ preview props written: ${previewPropsPath}`);

  console.log(`\n🎬 Launching Remotion Studio on http://localhost:3000`);
  console.log(`   - Scrub the timeline to preview any frame`);
  console.log(`   - Edit the SRT and run:  node caps.js import "<srt>"`);
  console.log(`   - Studio will hot-reload automatically`);
  console.log(`   - Ctrl+C to stop\n`);

  const cleanup = () => {
    try { server.close(); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const remotionCli = path.join(__dirname, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
  await runAsync('node', [remotionCli, 'studio'], { cwd: __dirname });
  server.close();
}

// ─── edit: launch the subtitle editor with auto-loaded video + captions ──
async function runEdit(videoPath, { previewSeconds }) {
  console.log('\n=== Subtitle Editor ===\n');

  // Need pre-scaled video so the editor's waveform matches what the agent renders
  const scaledVideoPath = prepareVideo(videoPath);

  // Find the captions file. Prefer JSON (preserves word timings) over SRT.
  const jsonPath = videoPath + '.captions.json';
  const srtPath = videoPath + '.captions.srt';
  let captionsPath = null;
  let captionsRoute = null;
  if (fileExists(jsonPath)) {
    captionsPath = jsonPath;
    captionsRoute = '/captions.json';
  } else if (fileExists(srtPath)) {
    captionsPath = srtPath;
    captionsRoute = '/captions.srt';
  } else {
    console.warn(`⚠ no captions file found (${jsonPath} or ${srtPath})`);
    console.warn('  Run `node rs-reels.mjs phase1 <video>` and then transcribe first.');
  }

  // Start the file server with both video + captions (if we have them)
  const routes = { '/video.mp4': scaledVideoPath };
  if (captionsPath) routes[captionsRoute] = captionsPath;

  const FILE_PORT = 7777;
  const { server } = await startFileServer(routes, FILE_PORT);

  // Build the editor URL with query params for auto-load
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const editorParams = new URLSearchParams({
    video: `http://127.0.0.1:${FILE_PORT}/video.mp4`,
    name: baseName,
  });
  if (captionsPath) {
    editorParams.set('captions', `http://127.0.0.1:${FILE_PORT}${captionsRoute}`);
  }
  const editorUrl = `http://localhost:5173/?${editorParams.toString()}`;

  console.log(`\n📝 Editor URL (open in browser):`);
  console.log(`   ${editorUrl}`);
  console.log(`\n🎬 Spawning Vite dev server in subtitle-editor/...\n`);

  // Spawn the editor's Vite dev server. The user opens the URL above manually
  // (Vite prints its own "Local: http://..." line, but with the right query
  // params).
  const editorDir = path.join(__dirname, 'subtitle-editor');
  if (!existsSync(path.join(editorDir, 'package.json'))) {
    console.error(`Subtitle editor not found at ${editorDir}`);
    console.error('Run `cd subtitle-editor && npm install` first.');
    server.close();
    process.exit(1);
  }

  const cleanup = () => {
    try { server.close(); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // npm on Windows is a .cmd file — Node's spawn needs shell:true to resolve it.
  // Args here are hardcoded ('run', 'dev'), so shell:true is safe.
  await runAsync('npm', ['run', 'dev'], { cwd: editorDir, shell: true });

  server.close();
}

// ─── phase 1: preprocessing (audio + metadata + face_map + energy) ────────
function runPhase1(videoPath) {
  console.log('\n=== Phase 1: Pre-processing ===\n');

  // Step 1.0: pre-scale to 1080×1920 — face detection + render both want this
  const scaledVideoPath = prepareVideo(videoPath);

  // Step 1.1: audio
  const wavPath = preprocessAudio(videoPath);

  // Step 1.2: metadata
  const metadataPath = extractMetadata(scaledVideoPath);

  // Step 1.3: face detection (on the pre-scaled video — that's what Reel renders)
  const faceMapPath = detectFaces(scaledVideoPath);

  // Step 1.4: audio energy
  const energyPath = analyzeAudioEnergy(wavPath);

  console.log('\n=== Phase 1 complete ===');
  console.log(`  metadata:  ${metadataPath}`);
  console.log(`  face_map:  ${faceMapPath}`);
  console.log(`  energy:    ${energyPath}`);
  console.log(`  audio:     ${wavPath}`);
  console.log(`  scaled:    ${scaledVideoPath}`);
}

// ─── main ──────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  const [cmd, videoArg] = args._;

  const VALID_CMDS = ['make', 'studio', 'phase1', 'edit'];

  if (!cmd || !videoArg || !VALID_CMDS.includes(cmd)) {
    console.log('Usage:');
    console.log('  rs-reels make   <video> --lecturer "Name" --workshop "Title" [--output reel.mp4] [--preview seconds]');
    console.log('  rs-reels studio <video> --lecturer "Name" --workshop "Title" [--preview seconds]');
    console.log('  rs-reels phase1 <video>');
    console.log('  rs-reels edit   <video>                              # opens the subtitle editor');
    console.log('\nCommon flags: --skip-audio --skip-transcribe --dry');
    console.log('\nphase1 = audio + 1080x1920 scale + metadata + face_map + audio_energy');
    console.log('edit   = serves the video + captions on :7777, runs the Vite editor on :5173');
    process.exit(1);
  }

  const videoPath = abs(videoArg);
  if (!fileExists(videoPath)) {
    console.error(`Video not found: ${videoPath}`);
    process.exit(1);
  }

  const lecturer = args.flags.lecturer || 'محاضر';
  const workshop = args.flags.workshop || 'ورشة RS Hero';
  const output =
    args.flags.output ||
    videoPath.replace(/\.[^.]+$/, '') + '-reel.mp4';
  const captionsOut = videoPath + '.captions.json';

  console.log(`📹 Video:    ${videoPath}`);
  console.log(`👤 Lecturer: ${lecturer}`);
  console.log(`🎯 Workshop: ${workshop}`);
  if (cmd === 'make') console.log(`📤 Output:   ${output}`);

  if (cmd === 'phase1') {
    runPhase1(videoPath);
    return;
  }

  if (cmd === 'edit') {
    await runEdit(videoPath, { previewSeconds: args.flags.preview });
    return;
  }

  if (cmd === 'studio') {
    await runStudio(videoPath, {
      lecturer,
      workshop,
      skipAudio: !!args.flags['skip-audio'],
      skipTranscribe: !!args.flags['skip-transcribe'],
      previewSeconds: args.flags.preview,
    });
    return;
  }

  // Step 1: audio
  let wavPath;
  if (!args.flags['skip-audio']) {
    wavPath = preprocessAudio(videoPath);
  } else {
    wavPath = videoPath.replace(/\.[^.]+$/, '') + '.16k.wav';
  }

  // Step 2: transcribe
  if (!args.flags['skip-transcribe']) {
    transcribe(wavPath, captionsOut);
    fixCaptions(captionsOut);
  }

  if (args.flags.dry) {
    console.log('\n--dry set: stopping before render.');
    return;
  }

  // Step 3: pre-scale video to 1080x1920 so OffthreadVideo doesn't re-crop every frame
  const scaledVideoPath = prepareVideo(videoPath);

  // Step 4: render
  await renderRemotion({
    videoPath: scaledVideoPath,
    sourceVideoPath: videoPath,
    captionsPath: captionsOut,
    lecturer,
    workshop,
    output,
    previewSeconds: args.flags.preview,
  });

  console.log(`\n✅ Done: ${output}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
