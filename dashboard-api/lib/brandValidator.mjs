// dashboard-api/lib/brandValidator.mjs
//
// Pure-function brand validator for animation plans.
// Reads brand-rules.json, walks the plan, returns { passed, hardViolations, softWarnings }.
// Used between planner success and render auto-spawn in routes/phases.mjs.
//
// Hard violations block the render. Soft warnings flow into the SSE log.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// TODO(S8.1): Multi-brand resolver. Currently hard-coded to RS.
const DEFAULT_RULES_PATH = path.join(REPO_ROOT, 'brands', 'rs', 'brand-rules.json');

const TEXT_FIELDS = new Set([
  'title', 'subtitle', 'headline', 'subline', 'footer', 'kicker', 'body',
  'term', 'term_sub', 'definition', 'example',
  'label', 'status_badge',
  'text',
  'keyword', 'primary_text', 'secondary_text',
  'lecturer_name', 'workshop_name',
  'tagline',
  'word',
]);

const TEXT_ARRAY_FIELDS = new Set(['steps']);

const NAMED_COLOR_FIELDS = new Set([
  'primary_color', 'secondary_color', 'color', 'bg_color', 'text_color',
]);

const FONT_FIELDS = new Set([
  'title_font', 'font', 'font_family', 'name_font', 'body_font',
]);

const ARABIC_INDIC_NUMERAL = /[٠-٩]/;
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;

export function loadBrandRules(rulesPath = DEFAULT_RULES_PATH) {
  const raw = readFileSync(rulesPath, 'utf8');
  return JSON.parse(raw);
}

export function validatePlan(plan, brandRules) {
  const hardViolations = [];
  const softWarnings = [];
  const ctx = { brandRules, hardViolations, softWarnings };

  checkComp(plan, ctx);
  checkTagline(plan, ctx);
  checkCaptionStyle(plan, ctx);
  checkSfx(plan, ctx);
  walkPlan(plan, ctx, []);
  checkSoftLowerThird(plan, ctx);
  checkSoftOverlayYPx(plan, ctx);
  checkSoftSceneSpacing(plan, ctx);

  return {
    passed: hardViolations.length === 0,
    hardViolations,
    softWarnings,
  };
}

export function formatVerdict(verdict) {
  const lines = [];
  if (verdict.passed) {
    lines.push('✓ Brand validator: PASSED');
  } else {
    lines.push(`✗ Brand validator: FAILED (${verdict.hardViolations.length} hard violations)`);
    for (const v of verdict.hardViolations) {
      lines.push(`  [${v.rule}] ${v.path}: ${v.message}`);
    }
  }
  if (verdict.softWarnings.length > 0) {
    lines.push(`⚠ ${verdict.softWarnings.length} soft warnings:`);
    for (const w of verdict.softWarnings) {
      lines.push(`  [${w.rule}] ${w.path}: ${w.message}`);
    }
  }
  return lines.join('\n');
}

// ───────── Hard checks (top-level) ─────────

function checkComp(plan, ctx) {
  if (!plan.comp) return;
  const expected = ctx.brandRules.hard_constraints.comp;
  if (plan.comp.width != null && plan.comp.width !== expected.width) {
    ctx.hardViolations.push({
      rule: 'comp',
      path: 'comp.width',
      message: `comp.width=${plan.comp.width} ≠ ${expected.width}`,
    });
  }
  if (plan.comp.height != null && plan.comp.height !== expected.height) {
    ctx.hardViolations.push({
      rule: 'comp',
      path: 'comp.height',
      message: `comp.height=${plan.comp.height} ≠ ${expected.height}`,
    });
  }
  if (plan.comp.fps != null && plan.comp.fps !== expected.fps) {
    ctx.hardViolations.push({
      rule: 'comp',
      path: 'comp.fps',
      message: `comp.fps=${plan.comp.fps} ≠ ${expected.fps}`,
    });
  }
}

function checkTagline(plan, ctx) {
  const tagline = plan.outro?.tagline;
  if (!tagline) return;
  const taglineRules = ctx.brandRules.brand.tagline;
  const canonical = taglineRules.canonical;
  const trimmed = String(tagline).trim();
  if (trimmed === canonical) return;

  const replacements = taglineRules.auto_fix_replacements ?? {};
  if (Object.prototype.hasOwnProperty.call(replacements, trimmed)) {
    ctx.hardViolations.push({
      rule: 'tagline',
      path: 'outro.tagline',
      message: `tagline "${trimmed}" should have been auto-fixed to "${canonical}" by the wrapper but wasn't`,
    });
  } else {
    ctx.hardViolations.push({
      rule: 'tagline',
      path: 'outro.tagline',
      message: `tagline "${trimmed}" ≠ canonical "${canonical}" (and not in auto_fix_replacements)`,
    });
  }
}

function checkCaptionStyle(plan, ctx) {
  const captionsRules = ctx.brandRules.hard_constraints.captions;
  const allowed = captionsRules.allowed_styles;
  const single = captionsRules.single_style_per_reel;
  const declared = plan.caption_style;

  if (declared && !allowed.includes(declared)) {
    ctx.hardViolations.push({
      rule: 'caption_style',
      path: 'caption_style',
      message: `caption_style "${declared}" not in allowed [${allowed.join(', ')}]`,
    });
  }

  if (single && Array.isArray(plan.caption_style_ranges) && plan.caption_style_ranges.length > 0) {
    const distinct = new Set(plan.caption_style_ranges.map(r => r?.style).filter(Boolean));
    if (distinct.size > 1) {
      ctx.hardViolations.push({
        rule: 'caption_style',
        path: 'caption_style_ranges',
        message: `single_style_per_reel violated: ${distinct.size} distinct styles (${[...distinct].join(', ')})`,
      });
    }
    if (distinct.size === 1 && declared && !distinct.has(declared)) {
      ctx.hardViolations.push({
        rule: 'caption_style',
        path: 'caption_style_ranges',
        message: `caption_style_ranges style "${[...distinct][0]}" ≠ caption_style "${declared}"`,
      });
    }
    for (const style of distinct) {
      if (!allowed.includes(style)) {
        ctx.hardViolations.push({
          rule: 'caption_style',
          path: 'caption_style_ranges',
          message: `caption_style_ranges contains "${style}" not in allowed [${allowed.join(', ')}]`,
        });
      }
    }
  }
}

function checkSfx(plan, ctx) {
  const rules = ctx.brandRules.hard_constraints.sfx;
  const sfx = plan.sfx;
  if (!sfx || sfx.enabled !== true) return;
  if (rules.override_requires_explicit_request && !sfx.explicitly_requested) {
    ctx.hardViolations.push({
      rule: 'sfx',
      path: 'sfx.enabled',
      message: 'sfx.enabled=true requires sfx.explicitly_requested=true (default policy: disabled)',
    });
  }
}

// ───────── Recursive walker (colors, fonts, logo, numerals) ─────────

function walkPlan(value, ctx, pathStack) {
  if (value == null) return;

  if (Array.isArray(value)) {
    const parentKey = pathStack[pathStack.length - 1];
    const isTextArray = typeof parentKey === 'string' && TEXT_ARRAY_FIELDS.has(parentKey);
    value.forEach((item, i) => {
      if (isTextArray && typeof item === 'string') {
        checkUserFacingText(item, ctx, joinPath([...pathStack, i]));
      }
      walkPlan(item, ctx, [...pathStack, i]);
    });
    return;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const here = [...pathStack, key];
      const pathStr = joinPath(here);
      if (typeof child === 'string') {
        checkStringValue(key, child, ctx, pathStr);
      } else if (typeof child === 'boolean') {
        checkBooleanFlag(key, child, pathStr, ctx);
      } else {
        walkPlan(child, ctx, here);
      }
    }
  }
}

function checkStringValue(key, value, ctx, pathStr) {
  // 1. Hex colors anywhere in the string.
  const hexMatches = value.match(HEX_COLOR);
  if (hexMatches) {
    const allowedHex = new Set(
      ctx.brandRules.hard_constraints.colors_allowed.map(c => normalizeHex(c.hex)),
    );
    for (const hex of hexMatches) {
      const norm = normalizeHex(hex);
      if (!allowedHex.has(norm)) {
        ctx.hardViolations.push({
          rule: 'colors',
          path: pathStr,
          message: `disallowed hex color ${hex} (allowed: ${[...allowedHex].join(', ')})`,
        });
      }
    }
  }

  // 2. Named color fields — value must be either a known name OR a hex/css already covered above.
  if (NAMED_COLOR_FIELDS.has(key)) {
    const allowedNames = new Set(
      ctx.brandRules.hard_constraints.colors_allowed.map(c => c.name),
    );
    const looksLikeHexOrCss = value.startsWith('#') || value.includes('(');
    if (!allowedNames.has(value) && !looksLikeHexOrCss) {
      ctx.hardViolations.push({
        rule: 'colors',
        path: pathStr,
        message: `color name "${value}" not in allowed names [${[...allowedNames].join(', ')}]`,
      });
    }
  }

  // 3. Font fields.
  if (FONT_FIELDS.has(key)) {
    const allowedFonts = new Set(
      ctx.brandRules.hard_constraints.fonts_allowed.map(f => f.family),
    );
    if (!allowedFonts.has(value)) {
      ctx.hardViolations.push({
        rule: 'fonts',
        path: pathStr,
        message: `font "${value}" not in allowed [${[...allowedFonts].join(', ')}]`,
      });
    }
  }

  // 4. User-facing text — Arabic-Indic numerals.
  if (TEXT_FIELDS.has(key)) {
    checkUserFacingText(value, ctx, pathStr);
  }
}

function checkUserFacingText(value, ctx, pathStr) {
  if (ARABIC_INDIC_NUMERAL.test(value)) {
    ctx.hardViolations.push({
      rule: 'numerals',
      path: pathStr,
      message: `Arabic-Indic numeral in user-facing text "${value}" (use western 0-9)`,
    });
  }
}

function checkBooleanFlag(key, value, pathStr, ctx) {
  const isOutroPath = pathStr.includes('outro');
  if ((key === 'hide_logo' || key === 'no_logo') && value === true && !isOutroPath) {
    ctx.hardViolations.push({
      rule: 'logo',
      path: pathStr,
      message: `${key}=true outside outro context (logo must remain visible per brand-rules)`,
    });
  }
  if (key === 'logo_visible' && value === false && !isOutroPath) {
    ctx.hardViolations.push({
      rule: 'logo',
      path: pathStr,
      message: 'logo_visible=false outside outro context',
    });
  }
}

function normalizeHex(hex) {
  let h = String(hex).toUpperCase();
  if (!h.startsWith('#')) h = `#${h}`;
  if (h.length === 4) {
    // #RGB → #RRGGBB
    h = '#' + h.slice(1).split('').map(c => c + c).join('');
  }
  return h;
}

function joinPath(stack) {
  return stack
    .map((s, i) => (typeof s === 'number' ? `[${s}]` : (i === 0 ? s : `.${s}`)))
    .join('')
    .replace(/^\./, '');
}

// ───────── Soft checks ─────────

function checkSoftLowerThird(plan, ctx) {
  const lt = plan.lower_third;
  if (!lt) return;
  const prefs = ctx.brandRules.soft_preferences.lower_third;
  for (const field of ['bar_width_px', 'name_size_px', 'title_size_px', 'padding_v_px', 'padding_h_px']) {
    if (lt[field] != null && prefs[field] != null && lt[field] !== prefs[field]) {
      ctx.softWarnings.push({
        rule: `lower_third.${field}`,
        path: `lower_third.${field}`,
        message: `lower_third.${field}=${lt[field]} (preferred ${prefs[field]})`,
      });
    }
  }
}

function checkSoftOverlayYPx(plan, ctx) {
  const overlays = plan.overlays ?? [];
  const minY = 1000;
  const maxY = 1200;
  overlays.forEach((overlay, i) => {
    if (overlay?.y_px == null) return;
    if (overlay.y_px < minY || overlay.y_px > maxY) {
      ctx.softWarnings.push({
        rule: 'overlay.y_px',
        path: `overlays[${i}].y_px`,
        message: `overlay y_px=${overlay.y_px} outside preferred range [${minY}, ${maxY}]`,
      });
    }
  });
}

function checkSoftSceneSpacing(plan, ctx) {
  const scenes = plan.scenes ?? [];
  const min = ctx.brandRules.soft_preferences.scenes.spacing_min_seconds;
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const cur = scenes[i];
    if (prev?.end_sec == null || cur?.start_sec == null) continue;
    const gap = cur.start_sec - prev.end_sec;
    if (gap < min) {
      ctx.softWarnings.push({
        rule: 'scenes.spacing',
        path: `scenes[${i}].start_sec`,
        message: `gap ${gap.toFixed(2)}s < min ${min}s (between ${prev.id ?? `scene_${i - 1}`} and ${cur.id ?? `scene_${i}`})`,
      });
    }
  }
}
