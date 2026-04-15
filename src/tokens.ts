export const tokens = {
  comp: {
    width: 1080,
    height: 1920,
    fps: 30,
  },
  colors: {
    primary: '#10479D',
    accent: '#FFB501',
    dark: '#0D1F3C',
    white: '#FFFFFF',
    overlay: 'rgba(13, 31, 60, 0.85)',
  },
  fonts: {
    heading: 'Cairo',
    body: 'Tajawal',
    headingWeight: 700,
    bodyWeight: 800,
  },
  captions: {
    fontSize: 56,
    lineHeight: 1.35,
    maxWidth: 820,
    position: { x: 540, y: 1420 },
    wordsPerChunk: 6,
    activeColor: '#FFB501',
    inactiveColor: '#FFFFFF',
    // ─── Phase 10 Round A — A4: emphasis variants ────────────────────
    // Single accent gold everywhere; variation is scale + letter-spacing
    // + shadow intensity. No second color (brand rule).
    emphasisVariants: {
      normal: {
        scale: 1.06,
        letterSpacing: '0px',
        rotation: 0, // degrees
        shadowBoost: 0, // 0..1 multiplier for accent shadow
      },
      pop: {
        scale: 1.16,
        letterSpacing: '2px',
        rotation: -1,
        shadowBoost: 0.5,
      },
      glow: {
        scale: 1.22,
        letterSpacing: '3px',
        rotation: -2,
        shadowBoost: 1.0,
      },
    },
  },
  logoBug: {
    position: { x: 540, y: 143 },
    width: 170,
    opacity: 0.9,
  },
  lowerThird: {
    durationSec: 4,
    startDelaySec: 0.5,
    slideDurationSec: 0.4,
    y: 1100,
    nameSize: 72,
    titleSize: 44,
    barWidth: 820,
    barHeight: 180,
  },
  outro: {
    durationSec: 5,
    logoWidth: 300,
    tagline: 'بنحقق طموحك المحاسبي',
    taglineSize: 46,
    website: 'rspaac.com',
    websiteSize: 60,
    ctaPrimary: 'احجز ورشتك الجاية',
    ctaPrimarySize: 68,
    ctaSubtext: 'راسلنا على رسائل الصفحة أو زور موقعنا',
    ctaSubtextSize: 34,
    socialIconSize: 96,
    socialIconGap: 36,
  },
  springs: {
    enter: { damping: 20, stiffness: 100, mass: 1.0 },
    exit: { damping: 25, stiffness: 120, mass: 0.8 },
    bounce: { damping: 12, stiffness: 150, mass: 1.0 },
    smooth: { damping: 30, stiffness: 80, mass: 1.2 },
  },
  // ─── Phase 10 Round A Tier 2 — A6: smart zoom easing variety ───────
  // Named curves for Smart Zoom ramps. Phase 6 picks one per moment
  // based on audio energy (high → crash_zoom, medium → dolly_in, low →
  // smooth_glide). Ramp frames scale with the curve's aggressiveness.
  smartZoomCurves: {
    smooth_glide: {
      spring: { damping: 30, stiffness: 60, mass: 1.5 },
      rampInFrames: 16,
      rampOutFrames: 12,
    },
    dolly_in: {
      spring: { damping: 22, stiffness: 90, mass: 1.0 },
      rampInFrames: 12,
      rampOutFrames: 9,
    },
    crash_zoom: {
      spring: { damping: 14, stiffness: 180, mass: 0.8 },
      rampInFrames: 6,
      rampOutFrames: 5,
    },
  },
  scenes: {
    // Default fade transitions for full-screen scenes
    fadeInFrames: 15,
    fadeOutFrames: 12,
    // ─── Phase 10 Round A — entrance variety ─────────────────────────
    // Per-entrance timing/physics. The wrapper reads these by name.
    entrances: {
      fade: {
        durationFrames: 15, // matches fadeInFrames for backward compat
      },
      scale_bounce: {
        durationFrames: 20,
        scaleFrom: 0.85,
        scaleTo: 1.0,
        // Mapped onto tokens.springs.bounce at runtime
      },
      blur_reveal: {
        durationFrames: 18,
        blurFromPx: 20,
        blurToPx: 0,
      },
      stagger_cascade: {
        // Very quick wrapper opacity so the scene's own child stagger is
        // the main show. No transform on the wrapper.
        durationFrames: 6,
      },
    },
    // Tier 2 — exit variety (mirrors entrances)
    exits: {
      fade: {
        durationFrames: 12,
      },
      scale_out: {
        durationFrames: 14,
        scaleFrom: 1.0,
        scaleTo: 1.08, // punches toward viewer as it fades
      },
      slide_down: {
        durationFrames: 14,
        translateYFromPx: 0,
        translateYToPx: 80,
      },
    },
    // ─── Phase 10 Round A — A2: dynamic stagger ──────────────────────
    // Stagger delay (frames) per element count. Keeps total stagger time
    // roughly constant regardless of how many elements a scene holds.
    dynamicStagger: {
      few: 15,   // 1-2 elements — wider spacing
      some: 10,  // 3-4 elements — medium
      many: 7,   // 5+ elements — tight
    },
    // Where the scene title sits (from top of comp)
    titleY: 380,
    titleDefaultSize: 76,
    // Padding from edges of safe area
    safePaddingX: 100,
    safePaddingY: 220,
    // Defaults for backgrounds when scene.background is missing
    defaultBackground: 'linear-gradient(135deg, #0D1F3C 0%, #10479D 100%)',
    // Step card defaults (process_stepper)
    stepCardWidth: 760,
    stepCardHeight: 200,
    stepCardGap: 32,
    stepCardRadius: 24,
    stepCardLabelSize: 64,
    stepCardNumberSize: 80,
    // Timeline defaults (process_timeline)
    timelineNodeSize: 120,
    timelineLabelSize: 44,
    timelineConnectorThickness: 6,
  },
  overlays: {
    // Body zone (y=900) is the only safe spot for floating overlays —
    // above the lower-third (y=1100) and captions (y=1280-1460). The
    // earlier default y=1140 collided with caption text and Omar
    // flagged the background card as visually covering the captions.
    // Fix: move to body zone AND drop the card — text floats with a
    // strong drop shadow instead of living inside a dark pill.
    defaultY: 900,
    defaultPaddingX: 36,
    defaultPaddingY: 20,
    defaultRadius: 12,
    defaultPrimarySize: 64,
    defaultSecondarySize: 32,
    fadeFrames: 8,
    slideOffsetPx: 24,
  },
  // ─── Phase 10 Round B — F1: SFX layer ─────────────────────────────
  // Disabled by default. Omar reviewed the first reel with SFX on
  // (2026-04-15) and flagged them as distracting even at 12-20%
  // volumes. The layer stays in the codebase but is off by default;
  // flip `enabled: true` per-project if desired.
  sfx: {
    enabled: false,
    globalVolume: 1.0, // multiplier on top of per-event volume
    events: {
      scene_enter:   { file: 'sfx/scene_enter.mp3',   volume: 0.18 },
      keyword_pop:   { file: 'sfx/keyword_pop.mp3',   volume: 0.14 },
      zoom_start:    { file: 'sfx/zoom_start.mp3',    volume: 0.12 },
      outro_swoosh:  { file: 'sfx/outro_swoosh.mp3',  volume: 0.20 },
    },
  },
} as const;

// ─── Phase 10 Round A — A2: dynamic stagger helper ───────────────────
/**
 * Picks a per-element stagger delay (frames) based on element count.
 * Fewer elements get wider spacing; more elements get tight spacing —
 * total stagger time stays roughly constant. Scenes can override by
 * passing a fixed `stagger_delay_frames` on the element.
 */
export function getStaggerDelay(elementCount: number): number {
  if (elementCount <= 2) return tokens.scenes.dynamicStagger.few;
  if (elementCount <= 4) return tokens.scenes.dynamicStagger.some;
  return tokens.scenes.dynamicStagger.many;
}
