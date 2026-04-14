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

// Spawn a tiny HTTP server to serve the input video over localhost — Remotion's
// OffthreadVideo cannot load file:// URLs during headless render.
function startVideoServer(videoPath, fixedPort = 0) {
  const stat = statSync(videoPath);
  const server = http.createServer((req, res) => {
    // CORS so Studio (port 3000) can fetch
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    const range = req.headers.range;
    const total = stat.size;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });
      createReadStream(videoPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      });
      createReadStream(videoPath).pipe(res);
    }
  });
  return new Promise((resolve) => {
    server.listen(fixedPort, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`✓ video server on http://127.0.0.1:${port}`);
      resolve({ server, url: `http://127.0.0.1:${port}/video.mp4` });
    });
  });
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

  const zoomPlan = loadZoomPlan(sourceVideoPath || videoPath, previewSeconds);

  // Spin up local video server
  const { server, url: videoUrl } = await startVideoServer(videoPath);

  const props = {
    videoSrc: videoUrl,
    captions: usedCaptions,
    lecturer,
    workshop,
    zoomPlan,
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

  const zoomPlan = loadZoomPlan(videoPath, previewSeconds);

  // Write preview-props.json → Root.tsx imports it as defaultProps
  const previewPropsPath = path.join(__dirname, 'src', 'preview-props.json');
  const props = { videoSrc: videoUrl, captions: usedCaptions, lecturer, workshop, zoomPlan };
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

  const VALID_CMDS = ['make', 'studio', 'phase1'];

  if (!cmd || !videoArg || !VALID_CMDS.includes(cmd)) {
    console.log('Usage:');
    console.log('  rs-reels make   <video> --lecturer "Name" --workshop "Title" [--output reel.mp4] [--preview seconds]');
    console.log('  rs-reels studio <video> --lecturer "Name" --workshop "Title" [--preview seconds]');
    console.log('  rs-reels phase1 <video>');
    console.log('\nCommon flags: --skip-audio --skip-transcribe --dry');
    console.log('\nphase1 = audio + 1080x1920 scale + metadata + face_map + audio_energy');
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
