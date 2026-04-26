#!/usr/bin/env node
/**
 * Claude planner — Stage α.
 *
 * Replaces the copy-paste handoff. Given a video, this script:
 *   1. Gathers the full creative-director context (transcript, brand
 *      rules, BRAND.md, recent ratings, style evolution, memory, phase
 *      docs).
 *   2. Spawns `claude -p --bare --tools ""` with the prompt on stdin.
 *      Tools are disabled so Claude can ONLY produce stdout text.
 *   3. Streams Claude's stdout live to our stdout (for SSE display in
 *      the dashboard) while also buffering it.
 *   4. After Claude exits, parses the buffer for three markers:
 *        === content_analysis.json ===
 *        === animation_plan.json ===
 *        === reflection ===
 *      Validates each JSON block parses, applies the tagline auto-fix
 *      from brand-rules.json, and writes:
 *        src/data/<basename>/content_analysis.json
 *        src/data/<basename>/animation_plan.json
 *        src/data/<basename>/reflection.txt
 *
 * Usage:
 *   node scripts/run_claude_planner.mjs <video-path>
 *
 * Exit codes:
 *   0 — both JSON files written and valid
 *   1 — context-gathering failure (missing source files)
 *   2 — Claude subprocess failed to start or crashed
 *   3 — Claude output was missing one of the required markers
 *   4 — Claude output had a marker but the JSON didn't parse
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ─── path helpers ────────────────────────────────────────────────────────

function videoBasename(videoPath) {
  return path.basename(videoPath, path.extname(videoPath));
}

function captionsPath(videoPath) {
  // Matches dashboard-api/lib/paths.mjs canonical layout.
  const base = videoBasename(videoPath);
  const dir = path.dirname(videoPath);
  const canonical = path.join(dir, '_pipeline', base, 'captions.json');
  if (existsSync(canonical)) return canonical;
  // Legacy: <video>.captions.json next to video.
  return path.join(dir, `${base}.captions.json`);
}

function dataDir(videoPath) {
  return path.join(REPO_ROOT, 'src', 'data', videoBasename(videoPath));
}

function contentAnalysisPath(videoPath) {
  return path.join(dataDir(videoPath), 'content_analysis.json');
}

function animationPlanPath(videoPath) {
  return path.join(dataDir(videoPath), 'animation_plan.json');
}

function reflectionPath(videoPath) {
  return path.join(dataDir(videoPath), 'reflection.txt');
}

// ─── context gathering ───────────────────────────────────────────────────

function readSafe(p, label) {
  try {
    return readFileSync(p, 'utf8');
  } catch (e) {
    console.error(`[planner] missing ${label}: ${p}`);
    return null;
  }
}

function lastNLines(text, n) {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - n)).join('\n');
}

function memoryDirForRepo() {
  // Claude Code's auto-memory location. Encoding mirrors how Claude Code
  // names the project dir — first char lowercased, separators replaced
  // with hyphens, leading c--Users-...-video-editor-ai-agent.
  const home = os.homedir();
  // Hardcoded for this project. If/when the repo ships beyond Omar this
  // should be derived from cwd.
  const projectId =
    'c--Users-PUZZLE-Documents-GrowthMora-platform-agents-video-editor-ai-agent';
  return path.join(home, '.claude', 'projects', projectId, 'memory');
}

async function gatherMemory() {
  const dir = memoryDirForRepo();
  if (!existsSync(dir)) {
    console.error(`[planner] memory dir not found: ${dir}`);
    return '';
  }
  const entries = await readdir(dir);
  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();
  const blocks = [];
  for (const f of mdFiles) {
    const content = await readFile(path.join(dir, f), 'utf8');
    blocks.push(`### ${f}\n\n${content.trim()}`);
  }
  return blocks.join('\n\n---\n\n');
}

function lastNRatings(logJsonText, n) {
  if (!logJsonText) return '(no feedback log)';
  try {
    const data = JSON.parse(logJsonText);
    const projects = data.projects ?? [];
    const recent = projects.slice(-n);
    return JSON.stringify({ projects: recent }, null, 2);
  } catch (e) {
    return `(failed to parse feedback/log.json: ${e.message})`;
  }
}

async function buildPrompt(videoPath, opts = {}) {
  const captionsP = captionsPath(videoPath);
  const captions = readSafe(captionsP, 'captions');
  if (!captions) {
    throw new Error(`captions not found at ${captionsP}`);
  }

  const brandRulesPath = path.join(REPO_ROOT, 'brands', 'rs', 'brand-rules.json');
  const brandRules = readSafe(brandRulesPath, 'brand-rules.json');
  if (!brandRules) {
    throw new Error(`brand-rules.json not found at ${brandRulesPath}`);
  }

  const brandMd = readSafe(path.join(REPO_ROOT, 'brands', 'rs', 'BRAND.md'), 'BRAND.md');
  const phaseSDoc = readSafe(
    path.join(REPO_ROOT, 'docs', 'phase-5-content-analysis.md'),
    'phase-5 doc',
  );
  const phase6Doc = readSafe(
    path.join(REPO_ROOT, 'docs', 'phase-6-animation-planning.md'),
    'phase-6 doc',
  );
  const styleEvolution = readSafe(
    path.join(REPO_ROOT, 'feedback', 'style_evolution.md'),
    'style_evolution.md',
  );
  const feedbackLog = readSafe(
    path.join(REPO_ROOT, 'feedback', 'log.json'),
    'feedback/log.json',
  );

  const memoryBlock = await gatherMemory();
  const recentRatings = lastNRatings(feedbackLog, 10);
  const styleEvolutionTail = lastNLines(styleEvolution, 60);

  // Canonical schema reference — a real, well-formed animation_plan from a
  // past reel. Used as a gold-standard example to teach Claude the exact
  // shape (NOT its content). We pick a plan from a DIFFERENT video so Claude
  // doesn't just copy the source material; it has to copy structure only.
  const canonicalRef = readSafe(
    path.join(
      REPO_ROOT,
      'src',
      'data',
      'محمد ريان ورشة الشامل 2',
      'animation_plan.json',
    ),
    'canonical schema reference plan',
  );

  // Read the prompt template (the creative-director brief).
  const templatePath = path.join(
    REPO_ROOT,
    'dashboard-api',
    'prompts',
    'planner.md',
  );
  const template = readSafe(templatePath, 'planner.md template');
  if (!template) {
    throw new Error(`prompt template not found at ${templatePath}`);
  }

  const inlined = [
    template,
    '',
    '## CONTEXT 1 — brand-rules.json (HARD constraints + soft preferences)',
    '',
    '```json',
    brandRules,
    '```',
    '',
    '## CONTEXT 2 — BRAND.md (human-readable brand profile)',
    '',
    brandMd ?? '(missing)',
    '',
    '## CONTEXT 3 — Phase 5 brief (content_analysis.json schema)',
    '',
    phaseSDoc ?? '(missing)',
    '',
    '## CONTEXT 4 — Phase 6 brief (animation_plan.json schema)',
    '',
    phase6Doc ?? '(missing)',
    '',
    '## CONTEXT 5 — Last 10 reel ratings (feedback/log.json)',
    '',
    '```json',
    recentRatings,
    '```',
    '',
    '## CONTEXT 6 — Style evolution (last 60 lines of feedback/style_evolution.md)',
    '',
    styleEvolutionTail || '(empty)',
    '',
    '## CONTEXT 7 — Cross-session memory (~/.claude/projects/.../memory/)',
    '',
    memoryBlock || '(empty)',
    '',
    '## CONTEXT 8 — Transcript (the captions for THIS reel)',
    '',
    '```json',
    captions,
    '```',
    '',
    '## CONTEXT 9 — Canonical schema example (FROM A DIFFERENT REEL — copy SHAPE not content)',
    '',
    'This is a real, validated animation_plan.json from "محمد ريان ورشة الشامل 2".',
    'Your output animation_plan.json MUST have the same top-level keys, the same scene shape,',
    'and the same element conventions (especially: elements is an array; step_card uses N elements).',
    '',
    '```json',
    canonicalRef ?? '(canonical reference missing)',
    '```',
    '',
    '---',
    '',
    'Now produce your output as specified above. Three markers, then nothing.',
    'Match CONTEXT 9 schema structurally — invent only the content that fits THIS transcript.',
    '',
  ].join('\n');

  return { prompt: inlined, captionsBytes: Buffer.byteLength(captions, 'utf8') };
}

// ─── output parsing ──────────────────────────────────────────────────────

const MARK_CONTENT = '=== content_analysis.json ===';
const MARK_PLAN = '=== animation_plan.json ===';
const MARK_REFLECTION = '=== reflection ===';

function extractBetween(buf, startMark, endMark) {
  const startIdx = buf.indexOf(startMark);
  if (startIdx === -1) return null;
  const after = startIdx + startMark.length;
  const endIdx = endMark ? buf.indexOf(endMark, after) : -1;
  const slice = endIdx === -1 ? buf.slice(after) : buf.slice(after, endIdx);
  return slice.trim();
}

function stripCodeFence(text) {
  // Claude sometimes wraps JSON in ```json ... ``` even when told not to.
  let t = text.trim();
  if (t.startsWith('```')) {
    const firstNL = t.indexOf('\n');
    if (firstNL !== -1) t = t.slice(firstNL + 1);
    if (t.endsWith('```')) t = t.slice(0, -3).trim();
  }
  return t.trim();
}

function parseOutput(buf) {
  const contentRaw = extractBetween(buf, MARK_CONTENT, MARK_PLAN);
  const planRaw = extractBetween(buf, MARK_PLAN, MARK_REFLECTION);
  const reflection = extractBetween(buf, MARK_REFLECTION, null);

  if (!contentRaw) {
    throw new Error(`output missing marker: ${MARK_CONTENT}`);
  }
  if (!planRaw) {
    throw new Error(`output missing marker: ${MARK_PLAN}`);
  }

  const contentJsonText = stripCodeFence(contentRaw);
  const planJsonText = stripCodeFence(planRaw);

  let contentAnalysis, animationPlan;
  try {
    contentAnalysis = JSON.parse(contentJsonText);
  } catch (e) {
    throw new Error(`content_analysis JSON parse failed: ${e.message}`);
  }
  try {
    animationPlan = JSON.parse(planJsonText);
  } catch (e) {
    throw new Error(`animation_plan JSON parse failed: ${e.message}`);
  }

  return {
    contentAnalysis,
    animationPlan,
    reflection: reflection ?? '',
  };
}

// ─── tagline auto-fix ────────────────────────────────────────────────────

function applyTaglineAutoFix(plan, brandRulesText) {
  if (!brandRulesText) return { plan, fixCount: 0 };
  let rules;
  try {
    rules = JSON.parse(brandRulesText);
  } catch {
    return { plan, fixCount: 0 };
  }
  const fixes = rules?.brand?.tagline?.auto_fix_replacements ?? {};
  const entries = Object.entries(fixes);
  if (entries.length === 0) return { plan, fixCount: 0 };

  let fixCount = 0;
  const json = JSON.stringify(plan);
  let fixed = json;
  for (const [wrong, right] of entries) {
    if (fixed.includes(wrong)) {
      const before = fixed;
      fixed = fixed.split(wrong).join(right);
      fixCount += (before.length - fixed.length === 0 ? 0 : 1);
    }
  }
  if (fixCount === 0) return { plan, fixCount: 0 };
  return { plan: JSON.parse(fixed), fixCount };
}

// ─── claude subprocess ───────────────────────────────────────────────────

function runClaude(promptText) {
  return new Promise((resolve, reject) => {
    // We deliberately do NOT pass --bare. --bare disables OAuth and the
    // OS keychain, requiring ANTHROPIC_API_KEY. Omar runs on Max plan via
    // OAuth, so dropping --bare is required for auth to work. The cost is
    // that auto-memory + project CLAUDE.md auto-load — which is fine: the
    // context they add is consistent with what we inline anyway.
    //
    // On Windows the binary is `claude.cmd`. Node's spawn() refuses to
    // execute .cmd files directly (CVE-2024-27980 hardening), so we use
    // shell: true to delegate to cmd.exe. This matches the launcher's
    // existing pattern (launcher/launcher.mjs spawns npm the same way).
    // The deprecation warning is acceptable — our args are hardcoded,
    // not user input, so injection is not a risk.
    const isWin = process.platform === 'win32';
    const claudeBin = isWin ? 'claude.cmd' : 'claude';
    console.log(`[planner] spawning ${claudeBin} -p --tools "" --output-format text`);
    const child = spawn(
      claudeBin,
      ['-p', '--tools', '', '--output-format', 'text', '--no-session-persistence'],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: REPO_ROOT,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        shell: isWin,
      },
    );

    let stdoutBuf = '';
    let stderrBuf = '';

    child.stdout.on('data', (chunk) => {
      const s = chunk.toString('utf8');
      stdoutBuf += s;
      // Mirror to our stdout so the dashboard SSE shows live output.
      process.stdout.write(s);
    });
    child.stderr.on('data', (chunk) => {
      const s = chunk.toString('utf8');
      stderrBuf += s;
      process.stderr.write(s);
    });

    child.on('error', (err) => {
      reject(new Error(`claude spawn error: ${err.message}`));
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `claude exited with code ${code}\n--- stderr ---\n${stderrBuf}`,
          ),
        );
        return;
      }
      resolve(stdoutBuf);
    });

    child.stdin.write(promptText);
    child.stdin.end();
  });
}

// ─── main ────────────────────────────────────────────────────────────────

async function main() {
  // Args: <video-path> [--dry-run]
  // --dry-run: build the prompt, write it to <data-dir>/_prompt.md, exit.
  //   Useful for reviewing what Claude will see without burning tokens.
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const videoPath = args.find((a) => !a.startsWith('--'));
  if (!videoPath) {
    console.error(
      'Usage: node scripts/run_claude_planner.mjs <video-path> [--dry-run]',
    );
    process.exit(1);
  }

  const tStart = Date.now();
  console.log(`[planner] video: ${videoPath}${dryRun ? ' (dry-run)' : ''}`);

  let prompt, captionsBytes;
  try {
    const built = await buildPrompt(videoPath);
    prompt = built.prompt;
    captionsBytes = built.captionsBytes;
  } catch (e) {
    console.error(`[planner] context gather failed: ${e.message}`);
    process.exit(1);
  }

  const promptBytes = Buffer.byteLength(prompt, 'utf8');
  // Rough token estimate: ~4 chars per token for mixed Arabic/English.
  const inputTokensEst = Math.round(promptBytes / 4);
  console.log(
    `[planner] prompt: ${promptBytes} bytes (~${inputTokensEst} input tokens), captions: ${captionsBytes} bytes`,
  );

  if (dryRun) {
    mkdirSync(dataDir(videoPath), { recursive: true });
    const dryOutPath = path.join(dataDir(videoPath), '_prompt.md');
    writeFileSync(dryOutPath, prompt, 'utf8');
    console.log(`[planner] dry-run: prompt written to ${dryOutPath}`);
    console.log(`[planner] dry-run: not invoking claude. exit 0.`);
    process.exit(0);
  }

  let stdoutBuf;
  try {
    stdoutBuf = await runClaude(prompt);
  } catch (e) {
    console.error(`[planner] claude subprocess failed: ${e.message}`);
    process.exit(2);
  }

  const outputBytes = Buffer.byteLength(stdoutBuf, 'utf8');
  const outputTokensEst = Math.round(outputBytes / 4);
  console.log(
    `[planner] output: ${outputBytes} bytes (~${outputTokensEst} output tokens), elapsed: ${Math.round((Date.now() - tStart) / 1000)}s`,
  );

  let parsed;
  try {
    parsed = parseOutput(stdoutBuf);
  } catch (e) {
    console.error(`[planner] parse failed: ${e.message}`);
    // Save raw output for debugging.
    const dumpPath = path.join(dataDir(videoPath), 'claude_raw_output.txt');
    mkdirSync(path.dirname(dumpPath), { recursive: true });
    writeFileSync(dumpPath, stdoutBuf, 'utf8');
    console.error(`[planner] raw output saved to: ${dumpPath}`);
    process.exit(parsed ? 4 : 3);
  }

  // Apply tagline auto-fix to the animation plan.
  const brandRulesText = readSafe(
    path.join(REPO_ROOT, 'brands', 'rs', 'brand-rules.json'),
    'brand-rules.json (post-parse)',
  );
  const { plan: planFixed, fixCount } = applyTaglineAutoFix(
    parsed.animationPlan,
    brandRulesText,
  );
  if (fixCount > 0) {
    console.log(`[planner] tagline auto-fix applied: ${fixCount} replacement(s)`);
  }

  // Write outputs.
  mkdirSync(dataDir(videoPath), { recursive: true });
  writeFileSync(
    contentAnalysisPath(videoPath),
    JSON.stringify(parsed.contentAnalysis, null, 2),
    'utf8',
  );
  writeFileSync(
    animationPlanPath(videoPath),
    JSON.stringify(planFixed, null, 2),
    'utf8',
  );
  if (parsed.reflection) {
    writeFileSync(reflectionPath(videoPath), parsed.reflection, 'utf8');
  }

  console.log(`[planner] wrote: ${contentAnalysisPath(videoPath)}`);
  console.log(`[planner] wrote: ${animationPlanPath(videoPath)}`);
  if (parsed.reflection) {
    console.log(`[planner] wrote: ${reflectionPath(videoPath)}`);
  }
  console.log(`[planner] done in ${Math.round((Date.now() - tStart) / 1000)}s`);
}

main().catch((e) => {
  console.error(`[planner] uncaught: ${e.stack || e.message}`);
  process.exit(2);
});
