#!/usr/bin/env node
// RS Reels Dashboard Launcher
//
// Single-click entry point that:
//   1. Starts dashboard-api (Express on :7778)
//   2. Starts dashboard-ui (Vite dev server, usually :5174)
//   3. Waits for both to be reachable
//   4. Opens the browser to the actual Vite port (handles fallback)
//   5. Keeps both children alive until the launcher is killed
//   6. Kills both child trees on SIGINT/SIGTERM
//
// Invoked by:
//   - launcher/rs-dashboard.cmd      (shows a terminal window)
//   - launcher/rs-dashboard.vbs      (hidden, via Windows shortcut)
//
// Exits non-zero on any startup failure with a clear message so the
// .cmd wrapper can `pause` and let Omar read it.

import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const API_PORT = 7778;
const STARTUP_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 500;

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
};

function log(prefix, color, msg) {
  process.stdout.write(`${color}[${prefix}]${COLORS.reset} ${msg}\n`);
}

// ─── port probes (IPv4 + IPv6) ──────────────────────────────────────────

function tryConnect(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch {}
      resolve(v);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    setTimeout(() => done(false), 700);
  });
}

async function waitForPort(port, label, timeoutMs = STARTUP_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [v4, v6] = await Promise.all([
      tryConnect('127.0.0.1', port),
      tryConnect('::1', port),
    ]);
    if (v4 || v6) return true;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  log(label, COLORS.red, `did not respond within ${timeoutMs / 1000}s`);
  return false;
}

// ─── child-process tracking + cleanup ───────────────────────────────────

/** @type {Array<import('child_process').ChildProcess>} */
const children = [];
let shuttingDown = false;

function killChildTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      // taskkill /T is the only way to kill a tree on Windows. Node's
      // kill() only targets the direct child, leaving npm/vite orphans.
      spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], {
        stdio: 'ignore',
        shell: false,
      });
    } else {
      child.kill('SIGTERM');
    }
  } catch (e) {
    log('shutdown', COLORS.red, `kill failed: ${e.message}`);
  }
}

function cleanupAndExit(code) {
  // Idempotent — if we're already shutting down, the second call
  // (usually from a child-exit handler after we killed the child)
  // is a no-op.
  if (shuttingDown) return;
  shuttingDown = true;
  log('shutdown', COLORS.yellow, 'stopping dashboard...');
  for (const child of children) killChildTree(child);
  // Give the OS ~1s to release ports before the exe actually exits.
  setTimeout(() => process.exit(code), 1000);
}

process.on('SIGINT', () => cleanupAndExit(0));
process.on('SIGTERM', () => cleanupAndExit(0));
// On Windows, Ctrl+C may not always hit SIGINT inside a spawned cmd
// wrapper — also handle the break signal.
process.on('SIGBREAK', () => cleanupAndExit(0));

// ─── open the browser to the final Vite port ───────────────────────────

function openInBrowser(targetUrl) {
  try {
    if (process.platform === 'win32') {
      // `start` is a cmd builtin; the empty "" is the window title slot
      // so a URL with spaces is parsed correctly.
      spawn('cmd', ['/c', 'start', '""', targetUrl], {
        stdio: 'ignore',
        shell: false,
        detached: true,
      }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [targetUrl], { stdio: 'ignore', detached: true }).unref();
    } else {
      spawn('xdg-open', [targetUrl], { stdio: 'ignore', detached: true }).unref();
    }
  } catch (e) {
    log('browser', COLORS.red, `failed to open: ${e.message}`);
  }
}

// ─── main flow ──────────────────────────────────────────────────────────

async function main() {
  process.stdout.write(
    `\n${COLORS.bold}RS Reels Dashboard Launcher${COLORS.reset}\n` +
      `${COLORS.dim}repo: ${REPO_ROOT}${COLORS.reset}\n\n`,
  );

  // 1. Start the API (yellow lane)
  log('api', COLORS.yellow, 'starting Express on :7778...');
  const apiChild = spawn('node', ['dashboard-api/server.mjs'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  children.push(apiChild);
  apiChild.stdout.on('data', (c) => process.stdout.write(`${COLORS.yellow}[api]${COLORS.reset} ${c}`));
  apiChild.stderr.on('data', (c) => process.stderr.write(`${COLORS.yellow}[api]${COLORS.reset} ${c}`));
  apiChild.on('exit', (code) => {
    if (shuttingDown) return;
    if (code !== 0 && code !== null) {
      log('api', COLORS.red, `exited with code ${code}`);
      cleanupAndExit(1);
    }
  });

  // 2. Start the UI (cyan lane) — we read its stdout to detect the final
  //    port number (Vite falls through if 5174 is taken).
  log('ui', COLORS.cyan, 'starting Vite dev server...');
  const uiChild = spawn('npm', ['run', 'dev'], {
    cwd: path.join(REPO_ROOT, 'dashboard-ui'),
    stdio: ['ignore', 'pipe', 'pipe'],
    // npm on Windows is a .cmd file — spawn needs shell:true to resolve it.
    shell: true,
  });
  children.push(uiChild);

  let uiPort = null;
  const portRegex = /http:\/\/localhost:(\d+)/;
  // Strip ANSI escape codes before regex-matching — Vite color-codes
  // the port number, e.g. `http://localhost:\x1b[1m5174\x1b[22m/`,
  // which breaks naive \d+ matching.
  // eslint-disable-next-line no-control-regex
  const ANSI_RE = /\x1b\[[0-9;]*m/g;
  const parsePort = (chunk) => {
    const text = chunk.toString('utf8');
    process.stdout.write(`${COLORS.cyan}[ui]${COLORS.reset} ${text}`);
    if (!uiPort) {
      const stripped = text.replace(ANSI_RE, '');
      const m = stripped.match(portRegex);
      if (m) uiPort = Number(m[1]);
    }
  };
  uiChild.stdout.on('data', parsePort);
  uiChild.stderr.on('data', (c) =>
    process.stderr.write(`${COLORS.cyan}[ui]${COLORS.reset} ${c}`),
  );
  uiChild.on('exit', (code) => {
    if (shuttingDown) return;
    if (code !== 0 && code !== null) {
      log('ui', COLORS.red, `exited with code ${code}`);
      cleanupAndExit(1);
    }
  });

  // 3. Wait for the API
  const apiReady = await waitForPort(API_PORT, 'api');
  if (!apiReady) {
    cleanupAndExit(1);
    return;
  }
  log('api', COLORS.green, `ready at http://localhost:${API_PORT}`);

  // 4. Wait for Vite to print its port + be reachable. Vite usually
  //    takes ~200-800ms to print; give it 20s max before giving up.
  const portDeadline = Date.now() + 20_000;
  while (!uiPort && Date.now() < portDeadline) {
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!uiPort) {
    log('ui', COLORS.red, 'never printed a port line');
    cleanupAndExit(1);
    return;
  }
  const uiReady = await waitForPort(uiPort, 'ui');
  if (!uiReady) {
    cleanupAndExit(1);
    return;
  }
  log('ui', COLORS.green, `ready at http://localhost:${uiPort}`);

  // 5. Open the browser
  const targetUrl = `http://localhost:${uiPort}/`;
  log('browser', COLORS.cyan, `opening ${targetUrl}`);
  openInBrowser(targetUrl);

  process.stdout.write(
    `\n${COLORS.green}${COLORS.bold}✓ Dashboard is live${COLORS.reset}\n` +
      `${COLORS.dim}   API: http://localhost:${API_PORT}\n` +
      `   UI:  ${targetUrl}\n` +
      `   Press Ctrl+C (or close this window) to stop both servers.${COLORS.reset}\n\n`,
  );

  // Keep the event loop alive — the children are running in the
  // background and we just idle here until SIGINT.
}

main().catch((e) => {
  log('launcher', COLORS.red, `fatal: ${e.message}`);
  cleanupAndExit(1);
});
