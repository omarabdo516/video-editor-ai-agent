#!/usr/bin/env node
/**
 * validate_plan.mjs — Structural + rule-based validator for animation plans.
 *
 * Usage:
 *   node scripts/validate_plan.mjs "<video_basename>"
 *   node scripts/validate_plan.mjs --path src/data/foo/animation_plan.json
 *
 * Reads the plan + face_map.json, then checks it against
 * `docs/scene-validation-rules.md` + the safe-zones memory. Prints a grouped
 * report with ✓/⚠/✗ per check. Exit code 0 if no failures (warnings OK),
 * 1 if any check fails.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..');

// ─── Rule constants (from docs/scene-validation-rules.md + memory) ────────
const RULES = {
  SCENE_MIN_SPACING_SEC: 15,     // docs/scene-validation-rules.md
  SCENE_MIN_DURATION_SEC: 5,
  SCENE_MAX_DURATION_SEC: 8,
  SCENE_MAX_COVERAGE_PCT: 60,    // practical upper bound

  OVERLAY_MIN_SPACING_SEC: 20,
  OVERLAY_MIN_DURATION_SEC: 3,
  OVERLAY_MAX_DURATION_SEC: 5,

  ZOOM_MIN_SPACING_SEC: 30,
  ZOOM_MIN_DURATION_SEC: 3,
  ZOOM_MAX_DURATION_SEC: 5,
  ZOOM_MIN_FACE_CONF: 0.5,

  MICRO_MIN_SPACING_SEC: 3,

  // Safe y-zones for small overlays (WordPop-style, not full-width pills)
  BODY_ZONE_Y_MIN: 700,
  BODY_ZONE_Y_MAX: 1090,
  // Full-width keyword overlays can sit in the bottom third
  KEYWORD_Y_MIN: 800,
  KEYWORD_Y_MAX: 1200,
};

// ─── terminal colors ─────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

// ─── collector ───────────────────────────────────────────────────────────
class Report {
  constructor() {
    this.groups = [];
    this.failCount = 0;
    this.warnCount = 0;
  }
  group(title) {
    const g = { title, items: [] };
    this.groups.push(g);
    return {
      pass: (msg) => g.items.push({ status: 'pass', msg }),
      warn: (msg) => {
        g.items.push({ status: 'warn', msg });
        this.warnCount++;
      },
      fail: (msg) => {
        g.items.push({ status: 'fail', msg });
        this.failCount++;
      },
      info: (msg) => g.items.push({ status: 'info', msg }),
    };
  }
  print() {
    for (const g of this.groups) {
      console.log(`\n${CYAN}━━━ ${g.title} ━━━${RESET}`);
      for (const item of g.items) {
        const icon =
          item.status === 'pass'
            ? `${GREEN}✓${RESET}`
            : item.status === 'warn'
            ? `${YELLOW}⚠${RESET}`
            : item.status === 'fail'
            ? `${RED}✗${RESET}`
            : `${DIM}·${RESET}`;
        console.log(`  ${icon} ${item.msg}`);
      }
    }
    console.log();
    if (this.failCount > 0) {
      console.log(`${RED}FAIL${RESET} ${this.failCount} failure(s), ${this.warnCount} warning(s)`);
    } else if (this.warnCount > 0) {
      console.log(`${YELLOW}WARN${RESET} ${this.warnCount} warning(s), 0 failures`);
    } else {
      console.log(`${GREEN}PASS${RESET} all checks clean`);
    }
  }
}

// ─── main ────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  let planPath;

  if (args[0] === '--path') {
    planPath = path.resolve(args[1]);
  } else if (args[0]) {
    planPath = path.join(REPO, 'src', 'data', args[0], 'animation_plan.json');
  } else {
    console.error('Usage:');
    console.error('  node scripts/validate_plan.mjs "<video_basename>"');
    console.error('  node scripts/validate_plan.mjs --path <path/to/animation_plan.json>');
    process.exit(2);
  }

  if (!existsSync(planPath)) {
    console.error(`${RED}Plan not found:${RESET} ${planPath}`);
    process.exit(2);
  }

  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const faceMap = tryLoadFaceMap(plan);

  const report = new Report();

  console.log(`${DIM}Validating:${RESET} ${planPath}`);
  if (faceMap) {
    console.log(`${DIM}Face map:${RESET} ${faceMap._sourcePath}  (${faceMap.faces?.length || 0} samples)`);
  } else {
    console.log(`${DIM}Face map:${RESET} ${YELLOW}not loaded${RESET} — zoom confidence checks will be skipped`);
  }

  const duration = plan.video?.duration_sec;

  // ─── Group 1: Structural ────────────────────────────────────────────────
  {
    const g = report.group('Structural');
    if (plan.schema_version) g.pass(`schema_version = ${plan.schema_version}`);
    else g.warn('missing schema_version');

    if (duration) g.pass(`video.duration_sec = ${duration.toFixed(2)}`);
    else g.fail('missing video.duration_sec — cannot check coverage');

    const sceneCount = plan.scenes?.length || 0;
    const overlayCount = plan.overlays?.length || 0;
    const zoomCount = plan.smart_zoom_plan?.moments?.length || 0;
    const microCount = plan.micro_events?.length || 0;
    const dividerCount = plan.chapter_dividers?.length || 0;
    g.info(
      `counts: scenes=${sceneCount} overlays=${overlayCount} zooms=${zoomCount} micro=${microCount} dividers=${dividerCount}`,
    );

    const totalMajor = sceneCount + overlayCount + zoomCount;
    const totalAll = totalMajor + microCount;
    if (duration) {
      const cadence = duration / Math.max(1, totalAll);
      if (cadence <= 5) g.pass(`event cadence ${cadence.toFixed(2)}s ≤ 5s (retention OK)`);
      else if (cadence <= 7) g.warn(`event cadence ${cadence.toFixed(2)}s — target is ≤4s, consider more micro events`);
      else g.fail(`event cadence ${cadence.toFixed(2)}s — WAY over target (≤4s). Add micro events.`);
    }
  }

  // ─── Group 2: Scenes ────────────────────────────────────────────────────
  {
    const g = report.group('Scenes');
    const scenes = (plan.scenes || []).slice().sort((a, b) => a.start_sec - b.start_sec);

    let totalSceneDuration = 0;

    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const dur = s.end_sec - s.start_sec;
      totalSceneDuration += dur;
      if (dur < RULES.SCENE_MIN_DURATION_SEC) {
        g.fail(`${s.id}: duration ${dur.toFixed(2)}s < ${RULES.SCENE_MIN_DURATION_SEC}s min`);
      } else if (dur > RULES.SCENE_MAX_DURATION_SEC) {
        g.warn(`${s.id}: duration ${dur.toFixed(2)}s > ${RULES.SCENE_MAX_DURATION_SEC}s recommended max`);
      } else {
        g.pass(`${s.id}: duration ${dur.toFixed(2)}s OK`);
      }

      if (i > 0) {
        const prev = scenes[i - 1];
        const gap = s.start_sec - prev.start_sec;
        if (gap < RULES.SCENE_MIN_SPACING_SEC) {
          g.fail(
            `${prev.id} → ${s.id}: start-to-start ${gap.toFixed(2)}s < ${RULES.SCENE_MIN_SPACING_SEC}s min`,
          );
        } else {
          g.pass(`${prev.id} → ${s.id}: start-to-start ${gap.toFixed(2)}s OK`);
        }
      }

      // Scene body sanity: must have at least one recognizable element
      const hasBody = (s.elements || []).some((e) =>
        [
          'step_card',
          'timeline_horizontal',
          'comparison_two_paths',
          'big_metaphor',
          'definition',
          'equation',
          'counter',
        ].includes(e.type),
      );
      if (!hasBody) {
        g.fail(`${s.id}: no recognizable body element — will render FallbackScene`);
      }
    }

    if (duration && scenes.length > 0) {
      const coverage = (totalSceneDuration / duration) * 100;
      const msg = `scene coverage ${coverage.toFixed(1)}% (${totalSceneDuration.toFixed(1)}s / ${duration.toFixed(1)}s)`;
      if (coverage > RULES.SCENE_MAX_COVERAGE_PCT) {
        g.warn(`${msg} — above ${RULES.SCENE_MAX_COVERAGE_PCT}% practical upper bound`);
      } else {
        g.pass(msg);
      }
    }
  }

  // ─── Group 3: Overlays ──────────────────────────────────────────────────
  {
    const g = report.group('Overlays');
    const overlays = (plan.overlays || []).slice().sort((a, b) => a.start_sec - b.start_sec);
    const scenes = plan.scenes || [];

    for (let i = 0; i < overlays.length; i++) {
      const o = overlays[i];
      const dur = o.end_sec - o.start_sec;
      if (dur < RULES.OVERLAY_MIN_DURATION_SEC || dur > RULES.OVERLAY_MAX_DURATION_SEC) {
        g.warn(`${o.id}: duration ${dur.toFixed(2)}s outside ${RULES.OVERLAY_MIN_DURATION_SEC}-${RULES.OVERLAY_MAX_DURATION_SEC}s`);
      }

      if (i > 0) {
        const prev = overlays[i - 1];
        const gap = o.start_sec - prev.start_sec;
        if (gap < RULES.OVERLAY_MIN_SPACING_SEC) {
          g.fail(
            `${prev.id} → ${o.id}: start-to-start ${gap.toFixed(2)}s < ${RULES.OVERLAY_MIN_SPACING_SEC}s min`,
          );
        }
      }

      // Must not overlap scenes
      const sceneOverlap = scenes.find(
        (s) => o.start_sec < s.end_sec && o.end_sec > s.start_sec,
      );
      if (sceneOverlap) {
        g.fail(`${o.id}: overlaps ${sceneOverlap.id}`);
      }

      // Y position check — accept both KeywordHighlight (wide) and Stamp (narrower)
      const y = o.y_px;
      if (y != null) {
        if (y >= RULES.KEYWORD_Y_MIN && y <= RULES.KEYWORD_Y_MAX) {
          // Good
        } else if (y >= RULES.BODY_ZONE_Y_MIN && y < RULES.KEYWORD_Y_MIN) {
          g.warn(`${o.id}: y=${y} in body zone (OK but unusual for overlays)`);
        } else {
          g.fail(
            `${o.id}: y=${y} outside safe zone (body ${RULES.BODY_ZONE_Y_MIN}-${RULES.BODY_ZONE_Y_MAX}, keyword ${RULES.KEYWORD_Y_MIN}-${RULES.KEYWORD_Y_MAX})`,
          );
        }
      }
    }

    if (overlays.length > 0 && report.failCount === 0) {
      g.pass(`${overlays.length} overlay(s), spacing + y + scene non-overlap all OK`);
    }
  }

  // ─── Group 4: Smart Zooms ───────────────────────────────────────────────
  {
    const g = report.group('Smart Zooms');
    const zooms = (plan.smart_zoom_plan?.moments || [])
      .slice()
      .sort((a, b) => a.startSec - b.startSec);

    // Filter out mini zooms (they have different rules — shorter + looser spacing)
    const bigZooms = zooms.filter((z) => (z.zoomLevel || 1.4) >= 1.2);
    const miniZooms = zooms.filter((z) => (z.zoomLevel || 1.4) < 1.2);

    g.info(`big zooms: ${bigZooms.length} · mini zooms: ${miniZooms.length}`);

    for (let i = 0; i < bigZooms.length; i++) {
      const z = bigZooms[i];
      const dur = z.endSec - z.startSec;
      if (dur < RULES.ZOOM_MIN_DURATION_SEC || dur > RULES.ZOOM_MAX_DURATION_SEC) {
        g.warn(`${z.id || `zoom_${i}`}: duration ${dur.toFixed(2)}s outside ${RULES.ZOOM_MIN_DURATION_SEC}-${RULES.ZOOM_MAX_DURATION_SEC}s`);
      }

      if (i > 0) {
        const prev = bigZooms[i - 1];
        const gap = z.startSec - prev.startSec;
        if (gap < RULES.ZOOM_MIN_SPACING_SEC) {
          g.fail(
            `${prev.id || `zoom_${i - 1}`} → ${z.id || `zoom_${i}`}: start-to-start ${gap.toFixed(2)}s < ${RULES.ZOOM_MIN_SPACING_SEC}s min`,
          );
        }
      }

      // Face confidence check (requires face_map)
      if (faceMap) {
        const conf = avgFaceConfidence(faceMap, z.startSec, z.endSec);
        if (conf == null) {
          g.warn(`${z.id || `zoom_${i}`}: no face data in window`);
        } else if (conf < RULES.ZOOM_MIN_FACE_CONF) {
          g.fail(`${z.id || `zoom_${i}`}: face conf ${conf.toFixed(2)} < ${RULES.ZOOM_MIN_FACE_CONF}`);
        }
      }
    }

    if (bigZooms.length > 0 && report.failCount === 0) {
      g.pass(`${bigZooms.length} big zoom(s), spacing + face conf OK`);
    }
  }

  // ─── Group 5: Micro Events ──────────────────────────────────────────────
  {
    const g = report.group('Micro Events');
    const micros = (plan.micro_events || [])
      .slice()
      .sort((a, b) => a.start_sec - b.start_sec);
    const scenes = plan.scenes || [];
    const overlays = plan.overlays || [];

    const spacingViolations = [];
    for (let i = 1; i < micros.length; i++) {
      const gap = micros[i].start_sec - micros[i - 1].start_sec;
      if (gap < RULES.MICRO_MIN_SPACING_SEC) {
        spacingViolations.push({
          prev: micros[i - 1],
          curr: micros[i],
          gap,
        });
      }
    }
    if (spacingViolations.length === 0 && micros.length > 1) {
      g.pass(`spacing ≥ ${RULES.MICRO_MIN_SPACING_SEC}s between all ${micros.length} events`);
    } else {
      for (const v of spacingViolations) {
        g.fail(
          `${v.prev.id} (${v.prev.type}@${v.prev.start_sec.toFixed(2)}s) → ${v.curr.id} (${v.curr.type}@${v.curr.start_sec.toFixed(2)}s): gap ${v.gap.toFixed(2)}s < ${RULES.MICRO_MIN_SPACING_SEC}s`,
        );
      }
    }

    // Micro events shouldn't overlap scenes
    let sceneCollisions = 0;
    for (const ev of micros) {
      const mid = (ev.start_sec + ev.end_sec) / 2;
      if (scenes.some((s) => mid >= s.start_sec && mid < s.end_sec)) {
        sceneCollisions++;
      }
    }
    if (sceneCollisions === 0) {
      g.pass('no micro events collide with scene windows');
    } else {
      g.fail(`${sceneCollisions} micro event(s) collide with scene windows`);
    }

    // Count by type
    const byType = {};
    for (const ev of micros) byType[ev.type] = (byType[ev.type] || 0) + 1;
    g.info(`by type: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(' · ') || 'none'}`);
  }

  // ─── Group 6: Chapter Dividers (only if any) ────────────────────────────
  if ((plan.chapter_dividers || []).length > 0) {
    const g = report.group('Chapter Dividers');
    for (const d of plan.chapter_dividers) {
      const dur = d.end_sec - d.start_sec;
      if (dur < 1.5 || dur > 4) {
        g.warn(`${d.id}: duration ${dur.toFixed(2)}s outside 1.5-4s recommended`);
      }
      if (!d.title) {
        g.fail(`${d.id}: missing title`);
      }
    }
  }

  // ─── Final ───────────────────────────────────────────────────────────────
  report.print();
  process.exit(report.failCount > 0 ? 1 : 0);
}

// ─── helpers ─────────────────────────────────────────────────────────────
function tryLoadFaceMap(plan) {
  const facePath = plan.source?.face_map;
  if (!facePath || !existsSync(facePath)) return null;
  try {
    const data = JSON.parse(readFileSync(facePath, 'utf8'));
    data._sourcePath = facePath;
    return data;
  } catch {
    return null;
  }
}

function avgFaceConfidence(faceMap, startSec, endSec) {
  const faces = faceMap.faces || [];
  const inWin = faces.filter(
    (f) => f.time >= startSec && f.time <= endSec && f.confidence != null,
  );
  if (inWin.length === 0) return null;
  return inWin.reduce((a, b) => a + b.confidence, 0) / inWin.length;
}

main();
