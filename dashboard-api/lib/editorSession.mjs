// Manages a singleton "subtitle editor" subprocess.
//
// `rs-reels.mjs edit <video>` is a long-running command that starts two
// servers at once:
//   1. HTTP file server on :7777 (serves the video + captions + the
//      POST /save/... endpoints the editor calls on Approve)
//   2. Vite dev server on :5173 (the actual editor UI)
//
// Before this module existed, the Dashboard only RETURNED the editor URL
// and Omar had to run `rs-reels.mjs edit` in a separate terminal — a
// footgun that defeats the point of the Dashboard. We now spawn the
// command ourselves and wait for port 5173 to become reachable before
// handing the URL to the frontend.
//
// Singleton: the file server + Vite both bind to fixed ports, so only
// ONE editor can be alive at a time. Switching to a different video
// tears the old subprocess down first.

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { REPO_ROOT } from './paths.mjs';

const FILE_PORT = 7777;
const EDITOR_PORT = 5173;
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 400;

/**
 * @typedef {Object} EditorSession
 * @property {string} videoId       - The video currently open in the editor
 * @property {string} videoPath     - Absolute path
 * @property {import('child_process').ChildProcess} child
 * @property {number} startedAt
 * @property {boolean} ready        - Flips true once port 5173 is reachable
 * @property {string[]} lines       - Last ~200 stdout/stderr lines for debugging
 */

/** @type {EditorSession|null} */
let current = null;

/** @type {string[]} Last 200 lines from the most recent editor subprocess. */
const recentLines = [];
const MAX_RECENT_LINES = 200;

export function getRecentEditorLines() {
  return [...recentLines];
}

/**
 * Try to TCP-connect to `host:port` within 800ms. Resolves true on
 * connect, false on error / timeout.
 */
function tryConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch {}
      resolve(v);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    setTimeout(() => done(false), 800);
  });
}

/**
 * Poll a TCP port until it accepts a connection on EITHER IPv4
 * (127.0.0.1) or IPv6 (::1), or time out. Vite on Windows binds
 * IPv6-only by default, so a pure 127.0.0.1 probe never succeeds.
 */
async function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [v4, v6] = await Promise.all([
      tryConnect('127.0.0.1', port),
      tryConnect('::1', port),
    ]);
    if (v4 || v6) return true;
    await new Promise((r) => setTimeout(r, READY_POLL_MS));
  }
  return false;
}

/**
 * Force-kill whatever process owns the given local TCP port. Used to
 * sweep orphaned Vite/file-server processes from prior sessions before
 * we spawn a fresh editor — both ports are fixed so any orphan would
 * cause our new spawn to fall through to a different port, breaking
 * the hardcoded URL handed to the frontend.
 */
function killProcessesOnPort(port) {
  if (process.platform !== 'win32') return;
  const res = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ` +
        `Select-Object -ExpandProperty OwningProcess -Unique | ` +
        `ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`,
    ],
    { stdio: 'ignore', shell: false },
  );
  if (res.status !== 0 && res.error) {
    console.warn(`[editor] port-${port} sweep failed: ${res.error.message}`);
  }
}

/**
 * Kill the current editor subprocess and wait for it to actually exit.
 * Safe to call when nothing is running.
 */
export async function stopEditor() {
  if (!current) return;
  const sess = current;
  current = null;
  try {
    if (!sess.child.killed) {
      // On Windows, `taskkill /T` is the only way to kill a tree —
      // Node's kill() only targets the direct child.
      if (process.platform === 'win32') {
        spawn('taskkill', ['/F', '/T', '/PID', String(sess.child.pid)], {
          stdio: 'ignore',
          shell: false,
        });
      } else {
        sess.child.kill('SIGTERM');
      }
    }
  } catch (e) {
    console.warn(`[editor] kill failed: ${e.message}`);
  }
  // Give the OS ~1.5s to release the ports before the caller starts a
  // new spawn on them.
  await new Promise((r) => setTimeout(r, 1500));
}

/**
 * Start (or reuse) a subtitle editor subprocess for the given video.
 *
 * If a session is already running for the *same* videoId, it's reused.
 * If it's running for a DIFFERENT video, that session is torn down first.
 *
 * @returns {Promise<{
 *   editorUrl: string,
 *   ready: boolean,
 *   reused: boolean,
 *   filePort: number,
 *   editorPort: number,
 * }>}
 */
export async function startEditor({ videoId, videoPath, editorUrl }) {
  // Reuse case — same video, same process, still alive.
  if (
    current &&
    current.videoId === videoId &&
    !current.child.killed &&
    current.child.exitCode === null
  ) {
    return {
      editorUrl,
      ready: current.ready || (await waitForPort(EDITOR_PORT, 5_000)),
      reused: true,
      filePort: FILE_PORT,
      editorPort: EDITOR_PORT,
    };
  }

  // Different video (or dead process) — stop the old one first.
  await stopEditor();

  // Sweep orphan listeners on our fixed ports. rs-reels.mjs binds 5173
  // and 7777 with no fallback in its hardcoded URL, so a stale Vite
  // from a prior session would force the new spawn to fall through to
  // 5174/5175 — and the URL we hand the frontend would still point at
  // 5173 (the orphan). Idempotent; no-op if the ports are already free.
  killProcessesOnPort(EDITOR_PORT);
  killProcessesOnPort(FILE_PORT);
  await new Promise((r) => setTimeout(r, 500));

  // Fresh spawn of `node rs-reels.mjs edit <videoPath>`.
  const child = spawn(
    'node',
    ['rs-reels.mjs', 'edit', videoPath],
    {
      cwd: REPO_ROOT,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Windows needs detached: false so taskkill /T finds the tree
      detached: false,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    },
  );

  const sess = {
    videoId,
    videoPath,
    child,
    startedAt: Date.now(),
    ready: false,
  };
  current = sess;

  // Drain stdout/stderr so the child doesn't deadlock on a full pipe.
  // Keep the last MAX_RECENT_LINES lines for debugging via the /editor
  // status route.
  recentLines.length = 0;
  const pushLine = (text) => {
    if (recentLines.length >= MAX_RECENT_LINES) recentLines.shift();
    recentLines.push(text);
    // Echo to the Dashboard API stdout so Omar can see it live in the
    // concurrently yellow lane.
    console.log(`[editor] ${text}`);
  };
  const makeSplitter = () => {
    let buf = '';
    return (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        pushLine(line);
      }
    };
  };
  if (child.stdout) child.stdout.on('data', makeSplitter());
  if (child.stderr) child.stderr.on('data', makeSplitter());

  child.on('exit', (code) => {
    // If the session we exited from is still the "current" one, clear it.
    if (current === sess) {
      console.warn(`[editor] subprocess exited with code ${code}`);
      current = null;
    }
  });
  child.on('error', (err) => {
    console.warn(`[editor] spawn error: ${err.message}`);
    if (current === sess) current = null;
  });

  // Wait for BOTH Vite (5173) and the rs-reels file server (7777) to come
  // up before returning. Probing only Vite leaves a window where Vite is
  // alive but the file server crashed (e.g. the captionsPath bug we hit on
  // 2026-04-16) — the editor would open and immediately fail to fetch
  // /captions.json. ready=false lets the frontend surface a real error.
  const [editorReady, fileReady] = await Promise.all([
    waitForPort(EDITOR_PORT, READY_TIMEOUT_MS),
    waitForPort(FILE_PORT, READY_TIMEOUT_MS),
  ]);
  const ready = editorReady && fileReady;
  sess.ready = ready;

  return {
    editorUrl,
    ready,
    reused: false,
    filePort: FILE_PORT,
    editorPort: EDITOR_PORT,
  };
}

/** Snapshot of the current session — used by routes that want to show state. */
export function getCurrentEditor() {
  if (!current) return null;
  return {
    videoId: current.videoId,
    videoPath: current.videoPath,
    startedAt: current.startedAt,
    ready: current.ready,
    alive: !current.child.killed && current.child.exitCode === null,
  };
}

/** Called at server shutdown so we don't leave orphaned subprocesses. */
export async function shutdownEditor() {
  await stopEditor();
}
