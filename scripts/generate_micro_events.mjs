#!/usr/bin/env node
/**
 * generate_micro_events.mjs — Tier 2 micro-event generator.
 *
 * Usage: node scripts/generate_micro_events.mjs "<video_basename>"
 *
 * Reads:
 *   - src/data/<basename>/content_analysis.json   (emphasis_moments, keywords)
 *   - src/data/<basename>/animation_plan.json     (occupied windows)
 *   - <video>.mp4.captions.json                   (word-level timings, for word_pop)
 *   - <video>.1080x1920.mp4.face_map.json         (face positions for mini_zoom)
 *
 * Writes:
 *   - src/data/<basename>/animation_plan.json     (adds / replaces `micro_events`)
 *
 * Strategy:
 *   1. Build occupied-window list from scenes + overlays + smart_zoom_plan.
 *   2. For each emphasis moment not inside / near an occupied window, create
 *      a Tier 2 event. Type chosen by intensity.
 *   3. Enforce min 3s gap between micro-events (keep stronger one on conflict).
 *   4. Second pass: fill any remaining gap >= 6s with word_pop events
 *      sampled from the caption stream (so we hit ~4s cadence everywhere).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..');

// ─── constants ─────────────────────────────────────────────────────────────
const OCCUPY_BUFFER_SEC = 1.2; // micro-event must be this far from a big-event boundary
const MIN_MICRO_GAP_SEC = 3.0; // min distance between consecutive micro-events
const MAX_GAP_FILL_SEC = 6.0; // fill gaps larger than this with synthetic word_pops
const TARGET_CADENCE_SEC = 4.0; // target cadence for reels retention

// Type assignment by intensity
const TYPE_BY_INTENSITY = {
  strong: 'mini_zoom',
  medium: 'word_pop', // will also alternate with caption_underline
  low: 'accent_flash',
};

// ─── main ──────────────────────────────────────────────────────────────────
function main() {
  const basename = process.argv[2];
  if (!basename) {
    console.error('Usage: node generate_micro_events.mjs "<video_basename>"');
    process.exit(1);
  }

  const dataDir = path.join(REPO, 'src', 'data', basename);
  const analysisPath = path.join(dataDir, 'content_analysis.json');
  const planPath = path.join(dataDir, 'animation_plan.json');

  if (!existsSync(analysisPath)) throw new Error(`Not found: ${analysisPath}`);
  if (!existsSync(planPath)) throw new Error(`Not found: ${planPath}`);

  const analysis = JSON.parse(readFileSync(analysisPath, 'utf8'));
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));

  // Resolve captions (may live in content_analysis.source) + face_map
  const captionsPath = plan.source?.captions || analysis.source?.captions;
  const faceMapPath = plan.source?.face_map || analysis.source?.metadata?.replace(/\.metadata\.json$/, '.face_map.json');
  if (!captionsPath || !faceMapPath) {
    throw new Error(
      `Could not resolve captions + face_map.\n  captions: ${captionsPath}\n  face_map: ${faceMapPath}`,
    );
  }

  const captions = JSON.parse(readFileSync(captionsPath, 'utf8'));
  const faceMap = JSON.parse(readFileSync(faceMapPath, 'utf8'));
  const faces = faceMap.faces || [];

  const duration = analysis.video?.duration_sec ?? captions.totalDuration;

  // ─── Pass 1: build occupied windows ───────────────────────────────────────
  const occupied = [];
  for (const s of plan.scenes || []) {
    occupied.push({ start: s.start_sec, end: s.end_sec, kind: 'scene', id: s.id });
  }
  for (const o of plan.overlays || []) {
    occupied.push({ start: o.start_sec, end: o.end_sec, kind: 'overlay', id: o.id });
  }
  for (const z of plan.smart_zoom_plan?.moments || []) {
    occupied.push({ start: z.startSec, end: z.endSec, kind: 'smart_zoom', id: z.id || 'zoom' });
  }
  occupied.sort((a, b) => a.start - b.start);

  const isBlocked = (t) => {
    for (const w of occupied) {
      if (t >= w.start - OCCUPY_BUFFER_SEC && t <= w.end + OCCUPY_BUFFER_SEC) {
        return true;
      }
    }
    return false;
  };

  // ─── Pass 2: convert emphasis_moments → micro-event candidates ────────────
  const candidates = [];
  const emphasis = analysis.emphasis_moments || [];
  let mediumToggle = 0; // alternate word_pop ↔ caption_underline for medium-intensity

  for (const em of emphasis) {
    const t = em.energy_time_sec;
    if (t == null) continue;
    if (isBlocked(t)) continue;

    let type;
    if (em.intensity === 'strong') {
      type = 'mini_zoom';
    } else if (em.intensity === 'medium') {
      type = mediumToggle % 2 === 0 ? 'word_pop' : 'caption_underline';
      mediumToggle++;
    } else {
      type = 'accent_flash';
    }

    candidates.push({
      time: t,
      type,
      intensity: em.intensity,
      subtitle_id: em.subtitle_id,
      anchor_text: em.text,
      energy: em.energy,
      energy_type: em.energy_type,
      source: 'emphasis',
    });
  }

  // ─── Pass 3: enforce min 3s gap between micro-events ──────────────────────
  candidates.sort((a, b) => a.time - b.time);
  const intensityRank = { strong: 3, medium: 2, low: 1 };
  const filtered = [];
  for (const cand of candidates) {
    const last = filtered[filtered.length - 1];
    if (!last || cand.time - last.time >= MIN_MICRO_GAP_SEC) {
      filtered.push(cand);
    } else {
      // Too close — keep the stronger one
      if ((intensityRank[cand.intensity] || 0) > (intensityRank[last.intensity] || 0)) {
        filtered[filtered.length - 1] = cand;
      }
    }
  }

  // ─── Pass 4: fill remaining gaps >= 6s with synthetic word_pops ───────────
  // Combine filtered + occupied windows into a single event timeline, sort by
  // start time, then find gaps and sample word_pops from the caption stream.
  const anchorList = [
    { start: 0, end: 0 },
    ...filtered.map((c) => ({ start: c.time, end: c.time })),
    ...occupied.map((w) => ({ start: w.start, end: w.end })),
    { start: duration, end: duration },
  ].sort((a, b) => a.start - b.start);

  const synthetic = [];
  for (let i = 0; i < anchorList.length - 1; i++) {
    const gapStart = anchorList[i].end;
    const gapEnd = anchorList[i + 1].start;
    const gap = gapEnd - gapStart;
    if (gap < MAX_GAP_FILL_SEC) continue;

    // Insert synthetic word_pops at ~TARGET_CADENCE intervals inside the gap
    const count = Math.floor(gap / TARGET_CADENCE_SEC);
    for (let k = 1; k <= count; k++) {
      const t = gapStart + (gap * k) / (count + 1);
      // Must still not be blocked by any occupied window buffer
      if (isBlocked(t)) continue;
      // Find the caption segment containing t and pick its "loudest" word
      const seg = findSegmentAt(captions, t);
      if (!seg) continue;
      const word = pickLoudestWord(seg, t);
      if (!word) continue;
      synthetic.push({
        time: t,
        type: 'word_pop',
        intensity: 'low',
        subtitle_id: seg.id ?? -1,
        anchor_text: seg.text,
        word,
        source: 'gap_fill',
      });
    }
  }

  // Merge synthetic + filtered, re-sort, re-enforce min gap
  const merged = [...filtered, ...synthetic].sort((a, b) => a.time - b.time);
  const finalEvents = [];
  for (const cand of merged) {
    const last = finalEvents[finalEvents.length - 1];
    if (!last || cand.time - last.time >= MIN_MICRO_GAP_SEC) {
      finalEvents.push(cand);
    } else if ((intensityRank[cand.intensity] || 0) > (intensityRank[last.intensity] || 0)) {
      finalEvents[finalEvents.length - 1] = cand;
    }
  }

  // ─── Pass 5: materialize each event with timing + side data ───────────────
  const microEvents = finalEvents.map((ev, i) => materialize(ev, i, captions, faces));

  // ─── Write back to animation_plan.json ───────────────────────────────────
  plan.micro_events = microEvents;
  plan.micro_events_generated_at = new Date().toISOString().slice(0, 10);
  plan.micro_events_stats = buildStats(microEvents, duration);

  writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');

  // ─── Report ───────────────────────────────────────────────────────────────
  console.log(`\n🧩 Micro-events generated for: ${basename}`);
  console.log(`   Duration: ${duration.toFixed(1)}s`);
  console.log(`   Emphasis candidates: ${candidates.length}`);
  console.log(`   After 3s spacing filter: ${filtered.length}`);
  console.log(`   Gap-fill synthetic: ${synthetic.length}`);
  console.log(`   Final micro-events: ${microEvents.length}`);
  const tierCount = (plan.scenes?.length || 0) + (plan.overlays?.length || 0) + (plan.smart_zoom_plan?.moments?.length || 0);
  const totalEvents = tierCount + microEvents.length;
  console.log(`   Tier 1 events: ${tierCount}`);
  console.log(`   Total events: ${totalEvents}`);
  console.log(`   Cadence: ${(duration / totalEvents).toFixed(2)}s per event (target ${TARGET_CADENCE_SEC}s)`);
  console.log(`\n   By type:`);
  for (const [type, n] of Object.entries(plan.micro_events_stats.by_type)) {
    console.log(`     ${type.padEnd(20)} ${n}`);
  }
  console.log(`\n✓ wrote: ${planPath}`);
}

// ─── helpers ───────────────────────────────────────────────────────────────
function findSegmentAt(captions, t) {
  return captions.segments.find((s) => t >= s.start && t <= s.end) || null;
}

function pickLoudestWord(segment, t) {
  if (!segment.words || segment.words.length === 0) {
    return segment.text?.split(/\s+/).filter(Boolean).slice(-1)[0] || null;
  }
  // Pick the word whose window contains t, else the word closest to t
  let best = segment.words[0];
  let bestDt = Infinity;
  for (const w of segment.words) {
    if (t >= w.start && t <= w.end) return w.word;
    const mid = (w.start + w.end) / 2;
    const dt = Math.abs(mid - t);
    if (dt < bestDt) {
      best = w;
      bestDt = dt;
    }
  }
  return best.word;
}

function avgFace(faces, tStart, tEnd) {
  const inWin = faces.filter((f) => f.time >= tStart && f.time <= tEnd && f.confidence >= 0.5);
  if (inWin.length === 0) return { cx: 0.5, cy: 0.4, conf: 0 };
  const cx = inWin.reduce((a, b) => a + b.face_center_x, 0) / inWin.length;
  const cy = inWin.reduce((a, b) => a + b.face_center_y, 0) / inWin.length;
  const conf = inWin.reduce((a, b) => a + b.confidence, 0) / inWin.length;
  return { cx: +cx.toFixed(3), cy: +cy.toFixed(3), conf: +conf.toFixed(2) };
}

function materialize(ev, i, captions, faces) {
  const id = `micro_${i + 1}`;
  const seg = findSegmentAt(captions, ev.time);
  const word = ev.word || (seg ? pickLoudestWord(seg, ev.time) : '');

  switch (ev.type) {
    case 'mini_zoom': {
      // 1.2s duration, 1.08x zoom centered on ev.time
      const startSec = +(ev.time - 0.3).toFixed(2);
      const endSec = +(ev.time + 0.9).toFixed(2);
      const face = avgFace(faces, startSec, endSec);
      return {
        id,
        type: 'mini_zoom',
        start_sec: startSec,
        end_sec: endSec,
        zoom_level: 1.08,
        center_x: face.cx,
        center_y: face.cy,
        intensity: ev.intensity,
        anchor_subtitle_id: ev.subtitle_id,
        anchor_text: ev.anchor_text?.slice(0, 60),
        source: ev.source,
      };
    }
    case 'word_pop': {
      const startSec = +(ev.time - 0.15).toFixed(2);
      const endSec = +(ev.time + 0.6).toFixed(2);
      return {
        id,
        type: 'word_pop',
        start_sec: startSec,
        end_sec: endSec,
        word,
        anchor_subtitle_id: ev.subtitle_id,
        intensity: ev.intensity,
        source: ev.source,
      };
    }
    case 'caption_underline': {
      const startSec = +(ev.time - 0.2).toFixed(2);
      const endSec = +(ev.time + 1.0).toFixed(2);
      return {
        id,
        type: 'caption_underline',
        start_sec: startSec,
        end_sec: endSec,
        anchor_subtitle_id: ev.subtitle_id,
        intensity: ev.intensity,
        source: ev.source,
      };
    }
    case 'accent_flash': {
      const startSec = +(ev.time - 0.1).toFixed(2);
      const endSec = +(ev.time + 0.5).toFixed(2);
      // Alternate edge side for variety
      const side = i % 2 === 0 ? 'right' : 'left';
      return {
        id,
        type: 'accent_flash',
        start_sec: startSec,
        end_sec: endSec,
        side,
        anchor_subtitle_id: ev.subtitle_id,
        intensity: ev.intensity,
        source: ev.source,
      };
    }
    default:
      return null;
  }
}

function buildStats(events, duration) {
  const by_type = {};
  const by_source = {};
  for (const e of events) {
    by_type[e.type] = (by_type[e.type] || 0) + 1;
    by_source[e.source] = (by_source[e.source] || 0) + 1;
  }
  return {
    total: events.length,
    cadence_sec: +(duration / Math.max(1, events.length)).toFixed(2),
    by_type,
    by_source,
  };
}

main();
