// Tests for dashboard-api/lib/brandValidator.mjs.
// Run: node --test dashboard-api/lib/__tests__/brandValidator.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePlan, loadBrandRules, formatVerdict } from '../brandValidator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const RULES = loadBrandRules();

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function minimalValidPlan() {
  return {
    schema_version: 1,
    caption_style: 'hormozi',
    scenes: [
      {
        id: 'scene_1',
        scene_type: 'big_metaphor',
        start_sec: 0,
        end_sec: 5,
        background: 'linear-gradient(135deg, #0D1F3C 0%, #10479D 100%)',
        title: 'الكلمتين',
        title_font: 'Alexandria',
        elements: [
          {
            type: 'big_metaphor',
            headline: 'كلمتين بس',
            subline: 'بمنتهى البساطة',
            footer: 'تعرفهم لكل ضريبة',
          },
        ],
      },
      {
        id: 'scene_2',
        scene_type: 'definition',
        start_sec: 25,
        end_sec: 32,
        background: '#10479D',
        title: 'الكلمة الأولى',
        title_font: 'Alexandria',
        elements: [
          {
            type: 'definition',
            term: 'الالتزامات الضريبية',
            definition: 'إيه المطلوب منك تقدمه',
          },
        ],
      },
    ],
    overlays: [
      {
        id: 'overlay_1',
        overlay_type: 'keyword_highlight',
        start_sec: 9,
        end_sec: 12,
        primary_text: 'مش صعبة',
        primary_color: 'accent',
        y_px: 1080,
      },
    ],
    micro_events: [],
    lower_third: {
      lecturer_name: 'أحمد علي',
      workshop_name: 'ورشة خبير الضرايب',
      start_sec: 0.5,
      duration_sec: 4,
    },
    outro: {
      duration_sec: 5,
      tagline: 'بنحقق طموحك المحاسبي',
    },
  };
}

// ───────── Pass case ─────────

test('minimal valid plan passes with no hard violations', () => {
  const plan = minimalValidPlan();
  const verdict = validatePlan(plan, RULES);
  if (!verdict.passed) {
    console.error(formatVerdict(verdict));
  }
  assert.equal(verdict.passed, true);
  assert.equal(verdict.hardViolations.length, 0);
});

test('real Ahmed Ali plan passes hard checks', () => {
  const planPath = path.join(
    REPO_ROOT,
    'src', 'data', 'أحمد علي - ورشة خبير الضرايب', 'animation_plan.json',
  );
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const verdict = validatePlan(plan, RULES);
  if (!verdict.passed) {
    console.error(formatVerdict(verdict));
  }
  assert.equal(verdict.passed, true, 'real shipped plan should pass hard checks');
});

// ───────── Hard violation cases (one per rule) ─────────

test('reject: comp.width does not match brand', () => {
  const plan = minimalValidPlan();
  plan.comp = { width: 1920, height: 1080, fps: 30 };
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.hardViolations.some(v => v.rule === 'comp'));
});

test('reject: disallowed hex color in scene background', () => {
  const plan = minimalValidPlan();
  plan.scenes[0].background = 'linear-gradient(135deg, #FF0000 0%, #00FF00 100%)';
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  const colorViolations = verdict.hardViolations.filter(v => v.rule === 'colors');
  assert.equal(colorViolations.length, 2);
});

test('reject: disallowed font in title_font', () => {
  const plan = minimalValidPlan();
  plan.scenes[0].title_font = 'Comic Sans MS';
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.hardViolations.some(v => v.rule === 'fonts'));
});

test('reject: hide_logo=true on a non-outro scene', () => {
  const plan = minimalValidPlan();
  plan.scenes[0].hide_logo = true;
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.hardViolations.some(v => v.rule === 'logo'));
});

test('accept: hide_logo=true is OK inside outro', () => {
  const plan = minimalValidPlan();
  plan.outro.hide_logo = true;
  const verdict = validatePlan(plan, RULES);
  if (!verdict.passed) console.error(formatVerdict(verdict));
  assert.equal(verdict.passed, true);
});

test('reject: tagline using a known auto-fixable wrong form', () => {
  const plan = minimalValidPlan();
  plan.outro.tagline = 'بنحقق طموحاتك المحاسبية';
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  const tag = verdict.hardViolations.find(v => v.rule === 'tagline');
  assert.ok(tag);
  assert.match(tag.message, /should have been auto-fixed/);
});

test('reject: tagline with a totally unknown form', () => {
  const plan = minimalValidPlan();
  plan.outro.tagline = 'شعار عشوائي تماماً';
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.hardViolations.some(v => v.rule === 'tagline'));
});

test('reject: caption_style_ranges with two distinct styles', () => {
  const plan = minimalValidPlan();
  plan.caption_style_ranges = [
    { start_sec: 0, end_sec: 30, style: 'hormozi' },
    { start_sec: 30, end_sec: 60, style: 'pop' },
  ];
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.hardViolations.some(v => v.rule === 'caption_style'));
});

test('reject: caption_style not in allowed list', () => {
  const plan = minimalValidPlan();
  plan.caption_style = 'mtv_neon';
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.hardViolations.some(v => v.rule === 'caption_style'));
});

test('reject: sfx.enabled=true without explicit_request', () => {
  const plan = minimalValidPlan();
  plan.sfx = { enabled: true };
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.hardViolations.some(v => v.rule === 'sfx'));
});

test('accept: sfx.enabled=true with explicitly_requested=true', () => {
  const plan = minimalValidPlan();
  plan.sfx = { enabled: true, explicitly_requested: true };
  const verdict = validatePlan(plan, RULES);
  if (!verdict.passed) console.error(formatVerdict(verdict));
  assert.equal(verdict.passed, true);
});

test('reject: Arabic-Indic numerals in user-facing text', () => {
  const plan = minimalValidPlan();
  plan.scenes[0].elements[0].headline = 'كلمتين ٢ بس';
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.hardViolations.some(v => v.rule === 'numerals'));
});

test('accept: western numerals in user-facing text', () => {
  const plan = minimalValidPlan();
  plan.scenes[0].elements[0].headline = 'كلمتين 2 بس';
  const verdict = validatePlan(plan, RULES);
  if (!verdict.passed) console.error(formatVerdict(verdict));
  assert.equal(verdict.passed, true);
});

test('reject: unknown named color value', () => {
  const plan = minimalValidPlan();
  plan.overlays[0].primary_color = 'magenta';
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.hardViolations.some(v => v.rule === 'colors'));
});

// ───────── Soft warnings ─────────

test('soft warning: overlay y_px outside [1000, 1200]', () => {
  const plan = minimalValidPlan();
  plan.overlays[0].y_px = 1500;
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, true, 'soft warning must not block');
  assert.ok(verdict.softWarnings.some(w => w.rule === 'overlay.y_px'));
});

test('soft warning: scene gap below 15s', () => {
  const plan = minimalValidPlan();
  plan.scenes[1].start_sec = plan.scenes[0].end_sec + 5;
  plan.scenes[1].end_sec = plan.scenes[1].start_sec + 5;
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, true);
  assert.ok(verdict.softWarnings.some(w => w.rule === 'scenes.spacing'));
});

test('soft warning: lower_third bar_width_px deviates from preferred', () => {
  const plan = minimalValidPlan();
  plan.lower_third.bar_width_px = 820;
  const verdict = validatePlan(plan, RULES);
  assert.equal(verdict.passed, true);
  assert.ok(verdict.softWarnings.some(w => w.rule === 'lower_third.bar_width_px'));
});

// ───────── Helpers ─────────

test('formatVerdict produces readable output for a passing plan', () => {
  const verdict = validatePlan(minimalValidPlan(), RULES);
  const formatted = formatVerdict(verdict);
  assert.match(formatted, /PASSED/);
});

test('formatVerdict surfaces all violations for a failing plan', () => {
  const plan = minimalValidPlan();
  plan.outro.tagline = 'شعار غلط';
  plan.scenes[0].title_font = 'Times New Roman';
  const verdict = validatePlan(plan, RULES);
  const formatted = formatVerdict(verdict);
  assert.match(formatted, /FAILED/);
  assert.match(formatted, /tagline/);
  assert.match(formatted, /fonts/);
});

test('hex normalization: short form (#RGB) and case-insensitivity', () => {
  const plan = clone(minimalValidPlan());
  plan.scenes[0].background = '#fff';
  const verdictShort = validatePlan(plan, RULES);
  if (!verdictShort.passed) console.error(formatVerdict(verdictShort));
  assert.equal(verdictShort.passed, true);

  plan.scenes[0].background = '#10479d';
  const verdictLower = validatePlan(plan, RULES);
  if (!verdictLower.passed) console.error(formatVerdict(verdictLower));
  assert.equal(verdictLower.passed, true);
});
