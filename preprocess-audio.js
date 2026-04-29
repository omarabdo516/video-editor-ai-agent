#!/usr/bin/env node
/**
 * preprocess-audio.js — Extract audio from video, loudness-normalize, convert to
 * 16kHz mono WAV for optimal Whisper ingestion.
 *
 * Usage:
 *   node preprocess-audio.js <input-video> [--output out.wav]
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const FFMPEG = 'C:/ffmpeg/bin/ffmpeg.exe';

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node preprocess-audio.js <input> [--output out.wav]');
    process.exit(1);
  }

  const input = path.resolve(args[0]);
  if (!fs.existsSync(input)) {
    console.error(`Input not found: ${input}`);
    process.exit(1);
  }

  const outIdx = args.indexOf('--output');
  const output = outIdx > -1
    ? path.resolve(args[outIdx + 1])
    : input.replace(/\.[^.]+$/, '') + '.16k.wav';

  console.log(`Input:  ${input}`);
  console.log(`Output: ${output}`);
  console.log('Running ffmpeg: extract → highpass/lowpass → loudnorm → 16kHz mono WAV');

  const ffArgs = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-y',
    '-i', input,
    '-vn',
    '-af',
    // Speech-band filter + two-pass-equivalent loudnorm (target -16 LUFS EBU R128)
    'highpass=f=60,lowpass=f=8000,loudnorm=I=-16:LRA=11:TP=-1.5,aresample=16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    output,
  ];

  const result = spawnSync(FFMPEG, ffArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`ffmpeg exited with code ${result.status}`);
    process.exit(result.status || 1);
  }

  const stats = fs.statSync(output);
  console.log(`\nDone. Output: ${output}  (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(output);
}

main();
