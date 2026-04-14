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

function preprocessAudio(inputVideoPath, { wavPath } = {}) {
  const outWav =
    wavPath || inputVideoPath.replace(/\.[^.]+$/, '') + '.16k.wav';
  if (fileExists(outWav)) {
    console.log(`✓ audio already preprocessed: ${outWav}`);
    return outWav;
  }
  run('node', [
    path.join(__dirname, 'preprocess-audio.js'),
    inputVideoPath,
    '--output',
    outWav,
  ]);
  return outWav;
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

/**
 * Detect a black segment at the very start of the video.
 *
 * Some source recordings open with 1-2 black frames before the first real
 * frame (camera warm-up, sensor init, editor cut). We scan the first few
 * seconds with ffmpeg's blackdetect filter and return the end of the leading
 * black segment in seconds, or 0 if the video opens clean.
 *
 * ffmpeg writes filter diagnostics to stderr, so we capture stderr and look
 * for a `black_start:0 black_end:X` line.
 */
function detectLeadingBlack(videoPath, maxScanSec = 3) {
  const result = spawnSync(
    'C:/ffmpeg/bin/ffmpeg.exe',
    [
      '-hide_banner',
      '-loglevel', 'info',
      '-t', String(maxScanSec),
      '-i', videoPath,
      '-vf', 'blackdetect=d=0.01:pic_th=0.96:pix_th=0.05',
      '-an',
      '-f', 'null',
      '-',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8', shell: false },
  );
  const stderr = result.stderr || '';
  const m = stderr.match(/black_start:0(?:\.0+)?\s+black_end:(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function prepareVideo(videoPath) {
  const scaledPath = videoPath.replace(/\.[^.]+$/, '') + '.1080x1920.mp4';
  if (fileExists(scaledPath)) {
    console.log(`✓ pre-scaled video already exists: ${scaledPath}`);
    return scaledPath;
  }
  // Trim leading black frames so the reel opens on the first real frame.
  // `-ss` before `-i` shifts both video and audio together, keeping them in
  // sync. All downstream steps (audio extraction, face detection, energy
  // analysis, transcription) operate on this scaled file, so every timestamp
  // is consistent with the trimmed origin.
  const blackEnd = detectLeadingBlack(videoPath);
  if (blackEnd > 0) {
    console.log(`  leading black detected: ${blackEnd.toFixed(3)}s — trimming`);
  }
  console.log(`\n> ffmpeg: cropping → 1080x1920 (center, cover)`);
  const ffArgs = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-y',
    ...(blackEnd > 0 ? ['-ss', blackEnd.toFixed(3)] : []),
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
//
// `savePaths` maps writable URL paths → absolute destination file paths.
// A POST to one of those paths writes the request body directly to disk.
// Used by the subtitle editor's Approve button so it can persist to the
// video directory without a Downloads → manual-copy round trip.
function startFileServer(routes, fixedPort = 0, savePaths = {}) {
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST') {
      const destPath = savePaths[req.url];
      if (!destPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`No writable route: ${req.url}\nAvailable: ${Object.keys(savePaths).join(', ')}`);
        return;
      }
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks);
          writeFileSync(destPath, body);
          // Refresh fileMeta so subsequent GETs see the new content length
          for (const [r, m] of Object.entries(fileMeta)) {
            if (m.path === destPath) fileMeta[r].stat = statSync(destPath);
          }
          console.log(`✓ saved ${body.length} bytes → ${path.basename(destPath)}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, path: destPath, bytes: body.length }));
        } catch (err) {
          console.error(`✗ save failed: ${err.message}`);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Write error: ${err.message}`);
        }
      });
      return;
    }

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

async function renderRemotion({
  videoPath,
  captionsPath,
  lecturer,
  workshop,
  output,
  previewSeconds,
  fromSec,
  toSec,
  sourceVideoPath,
}) {
  // Build props file
  const propsDir = path.join(__dirname, '.props');
  if (!existsSync(propsDir)) mkdirSync(propsDir, { recursive: true });
  const propsFile = path.join(propsDir, 'reel-props.json');

  const captions = JSON.parse(readFileSync(captionsPath, 'utf8'));

  // Range mode vs Preview mode:
  //   --from X --to Y → renders frames [X*fps, Y*fps] from the FULL composition.
  //                     Captions + plan stay intact. Output is (Y-X) seconds long.
  //   --preview N     → truncates everything to [0, N]. Composition is short.
  //                     Useful for quickly validating the start of a long video.
  const useRange = fromSec != null || toSec != null;

  let usedCaptions = captions;
  if (previewSeconds && !useRange) {
    const cutoff = Number(previewSeconds);
    const segs = captions.segments.filter((s) => s.start < cutoff);
    usedCaptions = {
      ...captions,
      segments: segs,
      segmentCount: segs.length,
      totalDuration: Math.min(captions.totalDuration, cutoff),
    };
  }

  // Phase 6 animation plan supersedes the legacy zoom_plan when present.
  // In range mode, pass the plan UNMODIFIED so Reel.tsx gets absolute times.
  // In preview mode, truncate so the composition is short.
  const planPreviewCutoff = useRange ? null : previewSeconds;
  const animationPlan = loadAnimationPlan(sourceVideoPath || videoPath, planPreviewCutoff);
  const zoomPlan = animationPlan?.smart_zoom_plan
    ? null // smart_zoom_plan is read from animationPlan inside Reel.tsx
    : loadZoomPlan(sourceVideoPath || videoPath, planPreviewCutoff);

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

    // Range mode: translate seconds → frame indices and pass --frames=start-end.
    // Remotion renders only those frames from the full composition.
    if (useRange) {
      const fps = 30; // tokens.comp.fps — hardcoded here to avoid importing TS
      const from = Math.max(0, Math.floor(Number(fromSec ?? 0) * fps));
      const to = toSec != null
        ? Math.max(from + 1, Math.floor(Number(toSec) * fps))
        : null;
      const frameSpec = to != null ? `${from}-${to}` : `${from}`;
      renderArgs.push(`--frames=${frameSpec}`);
      console.log(`⏱  range render: frames ${frameSpec} (${fromSec ?? 0}s → ${toSec ?? '∞'}s)`);
    }

    await runAsync('node', renderArgs, { cwd: __dirname });
  } finally {
    server.close();
  }
}

// ─── studio mode ───────────────────────────────────────────────────────────
async function runStudio(videoPath, { lecturer, workshop, skipAudio, skipTranscribe, previewSeconds }) {
  // Prep scaled (+ trimmed) video first so audio is cut from it
  const scaledVideoPath = prepareVideo(videoPath);

  // Prep audio + captions (reuses the same pipeline as `make`)
  const sourceBasedWav = videoPath.replace(/\.[^.]+$/, '') + '.16k.wav';
  let wavPath;
  if (!skipAudio) {
    wavPath = preprocessAudio(scaledVideoPath, { wavPath: sourceBasedWav });
  } else {
    wavPath = sourceBasedWav;
  }

  const captionsOut = videoPath + '.captions.json';
  if (!skipTranscribe) {
    transcribe(wavPath, captionsOut);
    fixCaptions(captionsOut);
  }

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

  // Writable routes — the editor POSTs here on Approve to persist directly
  // to disk next to the source video (no Downloads folder round trip).
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const videoDir = path.dirname(videoPath);
  const jsonDestPath = videoPath + '.captions.json';
  const srtDestPath = path.join(videoDir, `${baseName}.srt`);
  const savePaths = {
    '/save/captions.json': jsonDestPath,
    '/save/captions.srt': srtDestPath,
  };

  const FILE_PORT = 7777;
  const { server } = await startFileServer(routes, FILE_PORT, savePaths);

  // Build the editor URL with query params for auto-load
  const editorParams = new URLSearchParams({
    video: `http://127.0.0.1:${FILE_PORT}/video.mp4`,
    name: baseName,
    saveBase: `http://127.0.0.1:${FILE_PORT}`,
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

// ─── doctor: pre-flight health check ─────────────────────────────────────
async function runDoctor() {
  const RESET = '\x1b[0m';
  const GREEN = '\x1b[32m';
  const YELLOW = '\x1b[33m';
  const RED = '\x1b[31m';
  const DIM = '\x1b[2m';

  console.log('\n🩺 RS Reels — Doctor');
  console.log('─'.repeat(50));

  let failCount = 0;
  let warnCount = 0;

  function pass(msg) { console.log(`${GREEN}✓${RESET} ${msg}`); }
  function warn(msg) { console.log(`${YELLOW}⚠${RESET} ${msg}`); warnCount++; }
  function fail(msg) { console.log(`${RED}✗${RESET} ${msg}`); failCount++; }
  function info(msg) { console.log(`${DIM}·${RESET} ${msg}`); }

  // 1. Python venv
  if (fileExists(WHISPER_VENV_PYTHON)) {
    pass(`whisper venv: ${WHISPER_VENV_PYTHON}`);

    // Check Python deps (faster-whisper, librosa, mediapipe, torch+CUDA)
    const probe = spawnSync(
      WHISPER_VENV_PYTHON,
      ['-c', "import faster_whisper, librosa, mediapipe; import torch; print('OK', torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'no-gpu')"],
      { encoding: 'utf8' },
    );
    if (probe.status === 0) {
      const out = probe.stdout.trim();
      pass(`python deps: faster_whisper · librosa · mediapipe · torch`);
      const parts = out.split(' ');
      const torchVer = parts[1] || '?';
      const cuda = parts[2] === 'True';
      if (cuda) {
        const gpu = parts.slice(3).join(' ');
        pass(`CUDA: available · torch ${torchVer} · ${gpu}`);
      } else {
        warn(`CUDA: NOT available — torch ${torchVer} — render will be CPU only`);
      }
    } else {
      fail(`python deps: import failed — ${probe.stderr?.trim() || probe.stdout?.trim() || 'unknown'}`);
    }
  } else {
    fail(`whisper venv NOT FOUND: ${WHISPER_VENV_PYTHON}`);
    fail('  → Create it: `cd _tools && uv venv whisper-env && uv pip install faster-whisper librosa mediapipe torch`');
  }

  // 2. FFmpeg
  const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';
  if (fileExists(ffmpegPath)) {
    const ver = spawnSync(ffmpegPath, ['-version'], { encoding: 'utf8' });
    const firstLine = ver.stdout?.split('\n')[0] || 'ffmpeg';
    pass(`ffmpeg: ${firstLine.replace(/^ffmpeg version /, 'v')}`);
  } else {
    fail(`ffmpeg NOT FOUND at ${ffmpegPath}`);
    fail('  → Install from https://ffmpeg.org/download.html');
  }

  // 3. Node module deps
  const remotionCli = path.join(__dirname, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
  if (fileExists(remotionCli)) {
    const pkgJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const remotionVer = pkgJson.dependencies?.remotion || pkgJson.devDependencies?.remotion || '?';
    pass(`@remotion: installed (${remotionVer})`);
  } else {
    fail('@remotion NOT installed in node_modules — run `npm install`');
  }

  const editorModules = path.join(__dirname, 'subtitle-editor', 'node_modules');
  if (existsSync(editorModules)) {
    pass('subtitle-editor node_modules: installed');
  } else {
    warn('subtitle-editor node_modules: MISSING — run `cd subtitle-editor && npm install` before `rs-reels edit`');
  }

  // 4. Required Python scripts
  const requiredScripts = ['video_metadata.py', 'face_detect.py', 'audio_energy.py', 'transcribe.py'];
  const missing = requiredScripts.filter(
    (s) => !fileExists(path.join(__dirname, 'scripts', s)),
  );
  if (missing.length === 0) {
    pass(`scripts/: ${requiredScripts.join(' · ')}`);
  } else {
    fail(`scripts/ MISSING: ${missing.join(', ')}`);
  }

  // 5. Brand assets
  const brandLogo = path.join(__dirname, 'brands', 'rs', 'assets', 'logo.png');
  const publicLogo = path.join(__dirname, 'public', 'logo.png');
  if (fileExists(brandLogo)) pass('brands/rs/assets/logo.png: present');
  else warn('brands/rs/assets/logo.png: MISSING');
  if (fileExists(publicLogo)) pass('public/logo.png: present (used by staticFile)');
  else warn('public/logo.png: MISSING — logo bug + outro will be empty');

  // 6. TypeScript check (slow, optional)
  if (!process.argv.includes('--fast')) {
    info('running tsc --noEmit (skip with --fast)...');
    // On Windows, npx is npx.cmd. Avoid shell:true to silence a Node 24
    // deprecation about arg escaping.
    const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const tsc = spawnSync(npxBin, ['tsc', '--noEmit'], {
      cwd: __dirname,
      encoding: 'utf8',
    });
    if (tsc.status === 0) {
      pass('tsc --noEmit: clean');
    } else {
      fail('tsc --noEmit: FAILED');
      if (tsc.stdout) console.log(tsc.stdout);
      if (tsc.stderr) console.log(tsc.stderr);
    }
  } else {
    info('skipping tsc --noEmit (--fast)');
  }

  // 7. Plans in src/data/ — validate any that exist
  const dataDir = path.join(__dirname, 'src', 'data');
  if (existsSync(dataDir)) {
    const entries = existsSync(dataDir)
      ? (await import('node:fs')).readdirSync(dataDir, { withFileTypes: true })
      : [];
    const projects = entries.filter((e) => e.isDirectory());
    if (projects.length > 0) {
      info(`found ${projects.length} project(s) in src/data/`);
      for (const p of projects) {
        const planPath = path.join(dataDir, p.name, 'animation_plan.json');
        if (fileExists(planPath)) {
          info(`  → ${p.name} — run: node scripts/validate_plan.mjs "${p.name}"`);
        }
      }
    }
  }

  // ─── Final ────────────────────────────────────────────────────────────────
  console.log('─'.repeat(50));
  if (failCount > 0) {
    console.log(`${RED}FAIL${RESET} ${failCount} critical issue(s), ${warnCount} warning(s)`);
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(`${YELLOW}READY${RESET} with ${warnCount} warning(s)`);
  } else {
    console.log(`${GREEN}READY${RESET} all systems go 🚀`);
  }
}

// ─── phase 1: preprocessing (audio + metadata + face_map + energy) ────────
function runPhase1(videoPath) {
  console.log('\n=== Phase 1: Pre-processing ===\n');

  // Step 1.0: pre-scale (+ trim leading black) to 1080×1920 — face detection
  // and render both want this, and every downstream step needs to share its
  // trimmed timeline
  const scaledVideoPath = prepareVideo(videoPath);

  // Step 1.1: audio — extracted from the scaled video so the trim carries
  // through to captions and energy. Output path stays next to the source for
  // backwards compatibility with existing naming conventions.
  const sourceBasedWav = videoPath.replace(/\.[^.]+$/, '') + '.16k.wav';
  const wavPath = preprocessAudio(scaledVideoPath, { wavPath: sourceBasedWav });

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

  const VALID_CMDS = ['make', 'studio', 'phase1', 'edit', 'doctor'];

  if (!cmd || (cmd !== 'doctor' && !videoArg) || !VALID_CMDS.includes(cmd)) {
    console.log('Usage:');
    console.log('  rs-reels make   <video> --lecturer "Name" --workshop "Title" [--output reel.mp4]');
    console.log('                                                              [--preview seconds]');
    console.log('                                                              [--from sec --to sec]   # range render');
    console.log('  rs-reels studio <video> --lecturer "Name" --workshop "Title" [--preview seconds]');
    console.log('  rs-reels phase1 <video>');
    console.log('  rs-reels edit   <video>                                      # opens the subtitle editor');
    console.log('  rs-reels doctor                                              # pre-flight health check');
    console.log('\nCommon flags: --skip-audio --skip-transcribe --dry');
    console.log('\nphase1 = audio + 1080x1920 scale + metadata + face_map + audio_energy');
    console.log('edit   = serves the video + captions on :7777, runs the Vite editor on :5173');
    console.log('doctor = verifies venv, ffmpeg, deps, CUDA, and tsc pass');
    console.log('\nRange render example:');
    console.log('  node rs-reels.mjs make video.mp4 --lecturer "X" --workshop "Y" \\');
    console.log('    --skip-audio --skip-transcribe --from 70 --to 90 --output preview.mp4');
    process.exit(1);
  }

  // Doctor runs without a video argument
  if (cmd === 'doctor') {
    await runDoctor();
    return;
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

  // Step 1: pre-scale (+ trim leading black) to 1080×1920 — must come before
  // audio extraction so the .wav is cut from the trimmed file and every
  // timestamp downstream is consistent.
  const scaledVideoPath = prepareVideo(videoPath);

  // Step 2: audio — pulled from the scaled video (keeps captions aligned
  // with the trimmed visual). Wav file lives next to the source for
  // backwards compatibility.
  const sourceBasedWav = videoPath.replace(/\.[^.]+$/, '') + '.16k.wav';
  let wavPath;
  if (!args.flags['skip-audio']) {
    wavPath = preprocessAudio(scaledVideoPath, { wavPath: sourceBasedWav });
  } else {
    wavPath = sourceBasedWav;
  }

  // Step 3: transcribe
  if (!args.flags['skip-transcribe']) {
    transcribe(wavPath, captionsOut);
    fixCaptions(captionsOut);
  }

  if (args.flags.dry) {
    console.log('\n--dry set: stopping before render.');
    return;
  }

  // Step 4: render
  await renderRemotion({
    videoPath: scaledVideoPath,
    sourceVideoPath: videoPath,
    captionsPath: captionsOut,
    lecturer,
    workshop,
    output,
    previewSeconds: args.flags.preview,
    fromSec: args.flags.from != null ? Number(args.flags.from) : null,
    toSec: args.flags.to != null ? Number(args.flags.to) : null,
  });

  console.log(`\n✅ Done: ${output}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
