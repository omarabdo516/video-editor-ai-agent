#!/usr/bin/env node
/**
 * transcribe.js — Node wrapper that invokes the Python Whisper pipeline.
 *
 * Activates the whisper-env venv and runs transcribe.py against the given input.
 * Output: captions.json next to the input (or wherever --output points).
 *
 * Usage:
 *   node transcribe.js <video-or-audio> [--output captions.json] [--srt captions.srt]
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const WHISPER_VENV_PYTHON = `${process.env.USERPROFILE.replace(/\\/g, '/')}/Documents/Claude/_tools/whisper-env/.venv/Scripts/python.exe`;
const TRANSCRIBE_SCRIPT = path.resolve(new URL('./scripts/transcribe.py', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function run() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log('Usage: node transcribe.js <input> [--output captions.json] [--srt captions.srt] [--model large-v3]');
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (!fs.existsSync(WHISPER_VENV_PYTHON)) {
    console.error(`Python venv not found at: ${WHISPER_VENV_PYTHON}`);
    console.error('Run setup first: uv venv --python 3.11 in _tools/whisper-env/');
    process.exit(1);
  }

  if (!fs.existsSync(TRANSCRIBE_SCRIPT)) {
    console.error(`transcribe.py not found at: ${TRANSCRIBE_SCRIPT}`);
    process.exit(1);
  }

  const child = spawn(WHISPER_VENV_PYTHON, [TRANSCRIBE_SCRIPT, ...args], {
    stdio: 'inherit',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });

  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (err) => {
    console.error('Failed to start Python:', err.message);
    process.exit(1);
  });
}

run();
